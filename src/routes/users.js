// src/routes/users.js
const express = require('express');
const router = express.Router();

// Ejemplo de una ruta de usuario (puedes añadir más aquí más adelante)
router.get('/', (req, res) => {
    res.send('Rutas de usuario funcionando. (Implementación pendiente)');
});

module.exports = router;