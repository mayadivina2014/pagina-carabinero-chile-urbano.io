const mongoose = require('mongoose');

const MultaSchema = new mongoose.Schema({
    // La descripción ahora es opcional.
    descripcion: { type: String }, // ¡CORREGIDO! Eliminado 'required: true'
    motivo: { type: String, required: true }, // Asegúrate de que motivo sea requerido ya que es clave
    lugar: { type: String, required: true },  // Asegúrate de que lugar sea requerido
    monto: { type: Number, required: true, min: 0 }, // Monto debe ser requerido y no negativo
    pagada: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now }
}, { _id: true }); // He cambiado a _id: true. A menudo es útil para subdocumentos.
                  // Si no lo necesitas, puedes dejarlo en _id: false,
                  // pero si alguna vez necesitas actualizar/eliminar una multa específica
                  // del array, necesitarás su _id.

const VehiculoSchema = new mongoose.Schema({
    marca: { type: String, required: true },
    modelo: { type: String, required: true },
    patente: { type: String, required: true, unique: true },
    tipo_vehiculo: { type: String }, // Puedes añadir 'required: true' si es necesario
    color: { type: String },
    anio: { type: Number },
    imagen_url: { type: String },
    propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'Persona', required: false }, // required: false si puede existir sin propietario asignado inicialmente
    buscado: { type: Boolean, default: false },
    multas: [MultaSchema], // Usa el sub-schema de multas
    fechaRegistro: { type: Date, default: Date.now }
}, {
    timestamps: true // Añade timestamps para createdAt y updatedAt
});

module.exports = mongoose.model('Vehiculo', VehiculoSchema);