const mongoose = require('mongoose');

const personaSchema = new mongoose.Schema({
    nombreCompleto: {
        type: String,
        required: true,
        trim: true // Elimina espacios en blanco al principio y al final
    },
    rut: {
        type: String,
        required: true,
        unique: true, // Asegura que no haya RUTs duplicados en la base de datos
        trim: true
    },
    direccion: {
        type: String,
        trim: true,
        default: 'Sin información' // Valor por defecto si no se proporciona
    },
    telefono: {
        type: String,
        trim: true,
        default: 'Sin información'
    },
    email: {
        type: String,
        trim: true,
        lowercase: true, // Convierte el email a minúsculas antes de guardar
        // Puedes añadir una validación de formato de email más estricta si lo deseas:
        // match: [/\S+@\S+\.\S+/, 'is invalid email format'],
        // index: true // Para mejorar el rendimiento en búsquedas por email
        default: 'Sin información'
    }
}, {
    timestamps: true // Esto añade automáticamente campos 'createdAt' y 'updatedAt'
});

// Define el modelo 'Persona' usando el esquema.
// Mongoose automáticamente pluralizará 'Persona' a 'personas' para el nombre de la colección.
const Persona = mongoose.model('Persona', personaSchema);

// Exporta el modelo para que pueda ser utilizado en otros archivos
module.exports = Persona;