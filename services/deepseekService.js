const { Ollama } = require('ollama');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { Client } = require('pg');

const ollama = new Ollama({ url: 'http://127.0.0.1:11434' });
const EMBEDDING_DIM = 384;

async function getEmbedding(model, query) {
  const response = await ollama.embeddings({ model: model, prompt: query });
  return response.embedding.map(Number);
}

async function searchDocuments(query, model) {
  let queryEmbedding = await getEmbedding(model, query);
  const db = new Client({ connectionString: "postgres://postgres:mysecret@127.0.0.1:5432/postgres" });
  db.connect();
  queryEmbedding = queryEmbedding.slice(0, EMBEDDING_DIM);
  const formattedEmbedding = `[${queryEmbedding.join(",")}]`;

  const result = await db.query(`
    SELECT filename, content 
    FROM documents 
    ORDER BY embedding <-> $1::vector 
    LIMIT 5;
  `, [formattedEmbedding]);

  return result.rows.map(row => row.content).join("\n\n");
}

async function invokeOllamaChat(message, model) {
  const context = await searchDocuments(message, model);
  const response = await ollama.chat({
    model: model,
    messages: [
      { role: 'system', content: "Sei un assistente intelligente con accesso ai seguenti documenti." },
      { role: 'user', content: `Contesto:\n${context}\n\nDomanda:\n${message}` }
    ]
  });

  return response.message.content;
}

function parseYoloLabels(labelPath, classesPath) {
  const labelContent = fs.readFileSync(labelPath, 'utf8');
  const classNames = fs.readFileSync(classesPath, 'utf8').split('\n').map(c => c.trim());
  
  const lines = labelContent.trim().split('\n');
  console.log("- Label content:", lines);  // Debug: mostra il contenuto delle etichette
  
  return lines.map((line, idx) => {
    const [classId] = line.split(' ').map(Number);
    console.log(`Line ${idx}: classId = ${classId}, name = ${classNames[classId]}`); // Debug: mostra id e nome classe
    return classNames[classId] || `Unknown (${classId})`;
  });
}

async function describeOllamaImage(imagePath, model, customQuantity, labelPath, classesPath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mealSize = customQuantity || "";

  let labels = [];
  try {
    labels = parseYoloLabels(labelPath, classesPath);
  } catch (err) {
    console.log("- diocane:",err)
    labels = ['EMPTY'];
  }
  console.info("- label found:",labels);
  const labelsText = labels.length > 0 ? labels.join(", ") : "EMPTY";

  const promptThera = `What is in this image?
The image has been preprocessed using a YOLO model trained to detect different types of meals. 
Each detected item is enclosed in a bounding box and labeled with its meal type.
YOLO detected the following labels: ${labelsText}.
Use these bounding boxes to identify the dishes and estimate nutritional information and portion size.
For each detected dish, provide numeric details about the quantity and nutritional information: 
how many carbohydrates, sugars, fibers, proteins, and fats are in the meal (in grams, using double precision floating-point numbers), what is the portion size of the meal in grams, 
and what is the glycemic index (a number between 0 and 100).
Use the portion size evaluated inside the bounding box unless a custom portion is specified.
Return a section for each detected dish, using this format:
Example: Nutrition Values
- Carbohydrates: xx-yy grams ; 
- Proteins: xx-yy grams ;
- Sugars: xx-yy grams ;
- Fibers: xx-yy grams ;
- Fats: xx-yy grams ;
- GlycemicIndex: xx ;
- MealName: [translate in italian] ;
- Confidence: xx ;
- PortionSize: xx grams ;
- Ingredients: zz, qq ;
- YOLO LABEL IS: xx ;
IMPORTANT use always this template table format.
Replace xx, yy, zz, qq with actual values.
Translate the MealName and Ingredients to Italian.
If you're not confident about the estimation, return LOW as Confidence.`;
  
   
  const response = await ollama.chat({
    model: JSON.parse(model).model,
    messages: [
      { role: 'system', content: "Sei un nutrizionista esperto in diagnosi alimentari e diabete, parli in italiano, devi valutare le immagini dei piatti che vengono calcolati dal punto di vista quantitativo e calorico. Le immagini sono annotate con Yolo, e le bounding box indicano la tipologia del piatto." },
      { role: "user", content: promptThera, images: [base64Image] }
    ]
  });

  //console.info("- response.message.content:", response.message.content);
  return response.message.content;
}

async function invokeOllamaList() {
  try {
    const response = await ollama.list();
    return response.models.map(m => ({ id: m.model, name: m.name }));
  } catch (error) {
    console.error('Errore durante l\'invocazione di Ollama:', error);
  }
}

exports.getFitnessAdvice = async (message, model) => {
  return invokeOllamaChat(message, model);
};

exports.getModelList = async () => {
  return invokeOllamaList();
};

const AdmZip = require('adm-zip');

exports.describeImage = async (imagePath, model, customQuantity) => {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));

  const apiUrl = `http://localhost:8000/annotate?model=models/best.pt&conf=0.4&line_thickness=1`;
  const zipPath = path.join(__dirname, '../uploads/yolo', 'output.zip');
  const extractDir = path.join(__dirname, '../uploads/yolo/extracted');

  try {
    const response = await axios.post(apiUrl, form, {
      headers: form.getHeaders(),
      responseType: 'stream'
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);

    const files = fs.readdirSync(extractDir);
    const imageFile = files.find(f => f.endsWith('.jpg') || f.endsWith('.png'));
    const labelFile = files.find(f => f.endsWith('.txt'));

    console.info("- labelFile is:",labelFile);

    if (!imageFile || !labelFile) {
      throw new Error(`File mancante nello ZIP: ${!imageFile ? 'immagine' : ''} ${!labelFile ? 'label' : ''}`);
    }

    const imageFullPath = path.join(extractDir, imageFile);
    const labelFullPath = path.join(extractDir, labelFile);
    console.info("- labelFullPath is:",labelFullPath);

    const classesPath = path.join(__dirname, '../utility_scripts/Food-Detection/dataset/classes.txt');
    //console.info("- classesPath is:",classesPath);

    return describeOllamaImage(imageFullPath, model, customQuantity, labelFullPath, classesPath);

  } catch (err) {
    console.error('Errore chiamata YOLO API o estrazione ZIP:', err.message);
    throw err;
  }
};
