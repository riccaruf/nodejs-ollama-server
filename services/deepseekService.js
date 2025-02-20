const { Ollama } = require('ollama');

const ollama = new Ollama({
  url: 'http://192.168.1.87:11434'
});

async function invokeOllamaChat(message, model) {
  try {
    // Invia una richiesta al metodo chat specificando:
    // - Il modello da utilizzare (ad es. "deepseek")
    // - L'array dei messaggi (qui ne inviamo uno come input)
    const response = await ollama.chat({
      model: model,
      messages: [
        { role: 'user', content: message }
      ]
    });
    
    // Supponiamo che la risposta contenga un campo 'reply' con il testo generato
    console.log('Risposta da Ollama:', response.message.content);
    return response.message.content;

  } catch (error) {
    console.error('Errore durante l\'invocazione di Ollama:', error);
  }
}

async function invokeOllamaList() {
  try {
    console.log("- ollama list...")
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
   return invokeOllamaChat(message,model);
 
};

exports.getModelList = async () => {
  return invokeOllamaList();
 
};