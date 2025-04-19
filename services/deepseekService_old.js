const { Ollama } = require('ollama');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

require('dotenv').config();
const { Client } = require('pg');

const ollama = new Ollama({
  url: 'http://127.0.0.1:11434'
});
const EMBEDDING_DIM = 384

async function getEmbedding(model, query) {
  const response = await ollama.embeddings({ model: model, prompt: query });
  return response.embedding.map(Number);
}
// Funzione per cercare i documenti più simili nel database
async function searchDocuments(query, model) {
  var queryEmbedding = await getEmbedding(model,query);
  //console.log("Embedding ricevuto:", queryEmbedding);
  //console.log("Tipo:", typeof queryEmbedding);
  //console.log("È un array?", Array.isArray(queryEmbedding));
  const db = new Client({ connectionString: "postgres://postgres:mysecret@127.0.0.1:5432/postgres" });
  db.connect();
  queryEmbedding = queryEmbedding.slice(0, EMBEDDING_DIM);
  const formattedEmbedding = `[${queryEmbedding.join(",")}]`; // Converte in stringa PostgreSQL

  const result = await db.query(`
    SELECT filename, content 
    FROM documents 
    ORDER BY embedding <-> $1::vector 
    LIMIT 5;
  `, [formattedEmbedding]);

  return result.rows.map(row => row.content).join("\n\n");
}



async function invokeOllamaChat(message,model) {
  const context = await searchDocuments(message,model);
  console.info("- model:",model);
  const response = await ollama.chat({
      model: model,
      messages: [
          { role: 'system', content: "Sei un assistente intelligente con accesso ai seguenti documenti." },
          { role: 'user', content: `Contesto:\n${context}\n\nDomanda:\n${message}` }
      ]
  });

  return response.message.content;
}
const fs = require('fs');

async function describeOllamaImage(imagePath,model,customQuantity) {
  //const context = await searchDocuments(message,model);
  
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const mealSize = customQuantity || "";
  
  
// affinchè consideri le bounding box.
var promptThera = `What is in this image?
The image has been preprocessed using a YOLO model trained to detect different types of meals. 
Each detected item is enclosed in a bounding box and labeled with its meal type. 
Use these bounding boxes to identify the dishes and estimate nutritional information and portion size.
For each detected dish, provide numeric details about the quantity and nutritional information: 
how many carbohydrates, sugars, fibers, proteins, and fats are in the meal 
(in grams, using double precision floating-point numbers), what is the portion size of the meal in grams, 
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
Ensure the sum of the nutritional values makes sense based on total carbohydrates.
Translate the MealName and Ingredients to Italian.
Pay special attention to portion size. If a custom meal size is provided, use that value instead of estimating.
Example Custom Meal Size: ${mealSize} grams.
Bounding boxes are reliable indicators for each distinct meal—please use them accordingly.
If you're not confident about the estimation, return LOW as Confidence.
IMPORTANT In case you find the yolo bounding box please return exactly the label you read in YOLO LABEL IS mentioned in the previous table.
IMPORTANT In case you don't see any yolo bounding box please return YOLO LABEL IS : EMPTY! ; in the above table. IMPORTANT Only in this case otherwise please specify what you read as label text.
`

  //console.info("- model:",JSON.parse(model).model);
  //console.log("- prompt :",promptThera);
  // Invoca Ollama con la libreria ollama
  const response = await ollama.chat({
    model: JSON.parse(model).model,
    messages: [
      { role: 'system', content: "Sei un nutrizionista esperto in diagnosi alimentari e diabete, parli in italiano, devi valutare le immagini dei piatti che vengono calcolati dal punto di vista quantitativo e calorico. Le immagini sono annotate con Yolo, e le bounding box indicano la tipologia del piatto." },
      //{ role: "user", content: "Cosa vedi in questa immagine? Mi fornisci anche l'impatto calorico , puoi rispondere in italiano.", images: [base64Image] }]
      //{ role: "user", content: "Valuta le calorie del piatto che vedi ed esprimile in chilocalorie. Fornisci un numero sulla base di stime che sei in grado di fare. Stima la quantità. Stima il condimento. Mi serve un numero.", images: [base64Image] }]
      //{ role: "user", content: "Valuta le calorie del piatto che vedi ed esprimile in chilocalorie. Fornisci un numero sulla base di stime che sei in grado di fare. Stima la quantità. Stima il condimento. Mi serve un numero ed una risposta molto sintetica.", images: [base64Image] }]
      { role: "user", content: promptThera, images: [base64Image] }]
  });
  

  // Cancella il file temporaneo
  //fs.unlinkSync(imagePath);
  console.info("- response.message.content:",response.message.content);
  return response.message.content;
}

async function invokeOllamaList() {
  try {
    //console.log("- ollama list...")
    const response = await ollama.list();
    
    // Supponiamo che la risposta contenga un campo 'reply' con il testo generato
    let modelsJson = []
    for (let i = 0; i < response.models.length; i++) {
      //console.log(`ID: ${i + 1}, Nome: ${response.models[i].name}`);
      modelsJson.push({
        id: response.models[i].model,
        name: response.models[i].name
      })
    }
    //console.log('modelsJson:', modelsJson);
    
    return modelsJson;

  } catch (error) {
    console.error('Errore durante l\'invocazione di Ollama:', error);
  }
}

exports.getFitnessAdvice = async (message, model) => {
   //console.log('getFitnessAdvice');
   return invokeOllamaChat(message,model);
 
};

exports.getModelList = async () => {
  return invokeOllamaList();
};


exports.describeImage = async (imagePath, model,customQuantity) => {
  const form = new FormData();
 
  form.append('image', fs.createReadStream(imagePath));
  
  const apiUrl = `http://localhost:8000/annotate?model=../utility_scripts/models/best.pt&conf=0.4&line_thickness=1`;
  const outputPath = path.join(__dirname, '../uploads', 'output.jpg');
    
  try {
    const response = await axios.post(apiUrl, form, {
      headers: form.getHeaders(),
      responseType: 'stream', // Expect image back as stream
    });
    
    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      writer.on('finish', () => {
        console.log('✅ Immagine annotata salvata in:', outputPath);
        resolve();
      });
      writer.on('error', (err) => {
        console.error('❌ Errore durante il salvataggio:', err);
        reject(err);
      });
    });

  } catch (err) {
    console.error('Errore chiamata YOLO API:', err.message);
  } 
  await fs.promises.unlink(imagePath);
  return describeOllamaImage(outputPath, model,customQuantity);
};
