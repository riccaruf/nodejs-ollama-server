const { Ollama } = require('ollama');

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


async function describeOllamaImage(imagePath,model) {
  //const context = await searchDocuments(message,model);
  const fs = require('fs');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  // Prompt per Ollama con l'immagine in base64
  //const prompt = `Descrivi l'immagine seguente in dettaglio:\n\n![image](data:image/jpeg;base64,${base64Image})`;
  const promptThera = `What is in this image?
Provide numeric details about the nutritional information: how many carbohydrates, sugars, fibers, proteins, and fats 
are in the meal (these are in grams and make them as precise as possible with double precision floating-point numbers),
what is the portion size of the meal in grams, what is the glycemic index (this is between 0 and 100) of the meal.
Provide the nutritional information grams in a table with the title 'Nutrition Values'.
Example: Nutrition Values
- Carbohydrates: xx-yy grams ; 
- Proteins: xx-yy grams ;
- Sugars: xx-yy grams ;
- Fibers: xx-yy grams ;
- Fats: xx-yy grams ;
- GlycemicIndex: xx;
- MealName: pasta with something;
- Confidence: xx;
- PortionSize: xx grams;
- Ingredients: zz, qq;
Use always this table format.
Please replace xx, yy, zz, qq placeholder with the right values you choose.
Make sure that the sum of all the nutritional information equals the total carbohydrates.
Provide a list of the the Ingredients in the previous example descripted field called Ingredients.
Pay special attention if they mention the meal size. Determine the nutritional information based on the meal size.
Estimate the confidence of the correctness of your response, it must be one of the following: HIGH. 
If you cannot estimate confidence, then return LOW.
Also return the name of the meal as a string, without underscores.
The name of the meal and the ingredients should all be in Italian.`
  //console.info("- model:",JSON.parse(model).model);
  
  // Invoca Ollama con la libreria ollama
  const response = await ollama.chat({
    model: JSON.parse(model).model,
    messages: [
      { role: 'system', content: "Sei un nutrizionista esperto in diagnosi alimentari e diabete, parli in italiano, devi valutare le immagini dei piatti che vengono calcolati dal punto di vista calorico." },
      //{ role: "user", content: "Cosa vedi in questa immagine? Mi fornisci anche l'impatto calorico , puoi rispondere in italiano.", images: [base64Image] }]
      //{ role: "user", content: "Valuta le calorie del piatto che vedi ed esprimile in chilocalorie. Fornisci un numero sulla base di stime che sei in grado di fare. Stima la quantità. Stima il condimento. Mi serve un numero.", images: [base64Image] }]
      //{ role: "user", content: "Valuta le calorie del piatto che vedi ed esprimile in chilocalorie. Fornisci un numero sulla base di stime che sei in grado di fare. Stima la quantità. Stima il condimento. Mi serve un numero ed una risposta molto sintetica.", images: [base64Image] }]
      { role: "user", content: promptThera, images: [base64Image] }]
  });
  

  // Cancella il file temporaneo
  fs.unlinkSync(imagePath);
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

exports.describeImage = async (imagePath, model) => {
  return describeOllamaImage(imagePath, model);
};