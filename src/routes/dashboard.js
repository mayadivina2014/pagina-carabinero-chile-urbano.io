const express = require('express');
const router = express.Router();
const path = require('path');

// Esta ruta se ejecutará cuando se acceda a /dashboard
// El middleware en app.js ya protege esta ruta con req.isAuthenticated()
router.get('/', (req, res) => {
    // Renderiza o envía tu archivo dashboard.html
    res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
});

module.exports = router;