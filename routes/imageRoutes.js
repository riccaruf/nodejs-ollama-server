const express = require('express');
const router = express.Router();
const { upload } = require("./multerConfig");
const { processImagesUpload } = require('../controllers/imagesController');

//router.post('/', processImagesUpload);
router.post('/', upload.array("images"), (req, res) => {
    console.log("REQ.BODY:", req.body); // 👀 Logga il corpo della richiesta
    console.log("REQ.FILES:", req.files); // 📂 Logga i file ricevuti);
    processImagesUpload(req, res);
});

module.exports = router;