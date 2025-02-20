const { getFitnessAdvice } = require('../services/deepseekService');

exports.processFitnessSupport = async (req, res) => {
  try {
    const { message, model } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Messaggio non fornito' });
    }
    // Chiamata al servizio che gestisce l'integrazione con il modello IA
    console.log("- message:"+message+", model:"+model);
    const reply = await getFitnessAdvice(message,model);
    res.json({ reply });
  } catch (error) {
    console.error('Errore nella gestione del supporto fitness:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};
