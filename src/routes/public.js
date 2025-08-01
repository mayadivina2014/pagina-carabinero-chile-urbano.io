const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Rutas públicas que no requieren autenticación.

// GET /api/public/recent-vehicles - Obtener los vehículos registrados recientemente.
router.get('/recent-vehicles', publicController.getRecentVehicles);

// GET /api/public/wanted-people - Obtener personas buscadas.
router.get('/wanted-people', publicController.getWantedPeople);

// GET /api/public/recent-fines - Obtener las últimas multas registradas.
router.get('/recent-fines', publicController.getRecentFines);

module.exports = router;