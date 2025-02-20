const { getModelList } = require('../services/deepseekService');

exports.processModelList = async (req,res) => {
  try {
    // Chiamata al servizio che gestisce l'integrazione con il modello IA
    const reply = await getModelList();
    res.json(reply)
  } catch (error) {
    console.error('Errore nella gestione del supporto fitness:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};
