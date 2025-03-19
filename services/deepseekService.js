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
  const response = await ollama.chat({
      model: model,
      messages: [
          { role: 'system', content: "Sei un assistente intelligente con accesso ai seguenti documenti." },
          { role: 'user', content: `Contesto:\n${context}\n\nDomanda:\n${message}` }
      ]
  });

  return response.message.content;
}

// Esegui una query di esempio
async function main() {
  const query = "Spiegami il contenuto dei documenti sulla fisica quantistica.";
  const answer = await askLlama(query);
  console.log("🔍 Risposta:", answer);
  db.end();
}

async function invokeOllamaList() {
  try {
    //console.log("- ollama list...")
    const response = await ollama.list();
    
    // Supponiamo che la risposta contenga un campo 'reply' con il testo generato
    let modelsJson = []
    for (let i = 0; i < response.models.length; i++) {
      console.log(`ID: ${i + 1}, Nome: ${response.models[i].name}`);
      modelsJson.push({
        id: response.models[i].model,
        name: response.models[i].name
      })
    }
    console.log('modelsJson:', modelsJson);
    
    return modelsJson;

  } catch (error) {
    console.error('Errore durante l\'invocazione di Ollama:', error);
  }
}

exports.getFitnessAdvice = async (message, model) => {
   console.log('getFitnessAdvice');
   return invokeOllamaChat(message,model);
 
};

exports.getModelList = async () => {
  return invokeOllamaList();
 
};