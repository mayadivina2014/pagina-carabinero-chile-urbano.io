// src/routes/public.js
// Este archivo define las rutas públicas para las peticiones de la API.

const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController'); // Asegúrate de que la ruta a publicController sea correcta

// Define la ruta GET para obtener los vehículos registrados recientemente
// Esto se conectará a /api/public/recent-vehicles una vez que configures app.use en server.js
router.get('/recent-vehicles', publicController.getRecentVehicles);

// Define la ruta GET para obtener las personas buscadas
// Esto se conectará a /api/public/wanted-people
router.get('/wanted-people', publicController.getWantedPeople);

// Define la ruta GET para obtener las multas registradas recientemente
// Esto se conectará a /api/public/recent-fines
router.get('/recent-fines', publicController.getRecentFines);

module.exports = router;