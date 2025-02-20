const express = require('express');
const cors = require('cors');

const fitnessRoutes = require('./routes/fitnessRoutes');
const modelList = require('./routes/modelListRoutes');


const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // per il parsing del JSON nel body delle richieste

// Mount delle route
app.use('/api/fitness-support', fitnessRoutes);
app.use('/api/items', modelList);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
