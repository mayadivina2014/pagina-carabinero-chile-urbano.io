const express = require('express');
const router = express.Router();
const Persona = require('../models/Persona'); // Asegúrate de importar tu modelo Persona

// Middleware de autenticación (opcional, si quieres proteger estas rutas)
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'No autorizado. Por favor, inicia sesión.' });
};

// 1. Obtener TODAS las personas (GET /api/people)
router.get('/', async (req, res) => { // Puedes añadir ensureAuthenticated aquí si quieres
    try {
        const people = await Persona.find();
        res.json(people);
    } catch (err) {
        console.error('Error al obtener personas:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener personas.', error: err.message });
    }
});

// 2. Buscar personas (GET /api/people/search?query=...)
// Esta ruta es específica y debe ir ANTES de cualquier ruta que use /:id
router.get('/search', async (req, res) => { // Puedes añadir ensureAuthenticated aquí si quieres
    try {
        const { query } = req.query; // El término de búsqueda
        if (!query) {
            return res.status(400).json({ message: 'El parámetro de búsqueda "query" es requerido.' });
        }

        const searchRegex = new RegExp(query, 'i'); // Búsqueda insensible a mayúsculas/minúsculas

        // Búsqueda en nombreCompleto o rut
        const people = await Persona.find({
            $or: [
                { nombreCompleto: searchRegex },
                { rut: searchRegex }
            ]
        });

        if (people.length === 0) {
            return res.status(404).json({ message: 'No se encontraron personas que coincidan con la búsqueda.' });
        }

        res.json(people);
    } catch (err) {
        console.error('Error al buscar personas:', err);
        res.status(500).json({ message: 'Error interno del servidor al buscar personas.', error: err.message });
    }
});

// (Opcional) 3. Obtener una persona por ID (GET /api/people/:id)
router.get('/:id', async (req, res) => { // Puedes añadir ensureAuthenticated aquí si quieres
    try {
        const person = await Persona.findById(req.params.id);
        if (!person) {
            return res.status(404).json({ message: 'Persona no encontrada.' });
        }
        res.json(person);
    } catch (err) {
        console.error('Error al obtener persona por ID:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de persona inválido.', error: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al obtener persona.', error: err.message });
    }
});

// Agrega tus rutas POST, PUT, DELETE para /api/people aquí si las tienes
// ...

module.exports = router;