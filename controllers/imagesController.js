const { describeImage } = require('../services/deepseekService');

exports.processImagesUpload = async (req, res) => {
  try{
    console.log('processImagesUpload:',req.files[0].path);
    // Controlla se l'immagine è stata fornita
    if (!req.files[0]) {
      return res.status(400).json({ error: "Immagine non fornita" });
    }

    // Percorso dell'immagine salvata
    const imagePath = req.files[0].path;
    const model = req.body.model;
    const customQuantity = req.body.customQuantity;
    console.log('model', model);
    console.log('customQuantity', customQuantity);
    
    const reply = await describeImage(imagePath,model,customQuantity);
    res.json(reply);
  }catch(err){

    console.error('processImagesUpload error', err);
    return res.status(500).json({ message: "Errore durante il caricamento dell'immagine" });
  }
};
