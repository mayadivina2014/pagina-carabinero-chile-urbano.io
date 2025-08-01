const Vehiculo = require('../models/Vehiculo');
const Persona = require('../models/Persona'); // Asegúrate de que esta línea exista y sea correcta y que Persona.js exista.

// Obtener vehículos registrados recientemente para la sección pública
exports.getRecentVehicles = async (req, res) => {
    try {
        const vehicles = await Vehiculo.find()
            .sort({ createdAt: -1 }) // Usar createdAt si timestamps: true está habilitado en VehiculoSchema
            .limit(5)
            .select('patente marca modelo anio fechaRegistro imagen_url'); // Asegúrate de que 'anio' y 'fechaRegistro' existen

        res.json(vehicles);
    } catch (err) {
        console.error("Error fetching recent vehicles:", err);
        res.status(500).json({ message: 'Error al obtener vehículos recientes.' });
    }
};

// Obtener personas buscadas para la sección pública
exports.getWantedPeople = async (req, res) => {
    try {
        // Opción 1: Si tienes un campo 'buscado: { type: Boolean, default: false }' en tu esquema Persona
        const wantedPeople = await Persona.find({ buscado: true })
            .limit(5)
            .select('nombreCompleto rut edad motivo_busqueda descripcion_fisica lugar_busqueda');

        // Opción 2: Si no tienes 'buscado: true' y quieres usar los campos de descripción como indicador
        // (Descomenta esta opción y comenta la Opción 1 si este es tu caso)
        /*
        const wantedPeople = await Persona.find({
            $or: [
                { motivo_busqueda: { $exists: true, $ne: null, $ne: '' } },
                { descripcion_fisica: { $exists: true, $ne: null, $ne: '' } },
                { lugar_busqueda: { $exists: true, $ne: null, $ne: '' } }
            ]
        })
        .limit(5)
        .select('nombreCompleto rut edad motivo_busqueda descripcion_fisica lugar_busqueda');
        */

        res.json(wantedPeople);
    } catch (err) {
        console.error("Error fetching wanted people:", err);
        // Es importante que el modelo Persona esté correctamente importado y tenga los campos esperados.
        res.status(500).json({ message: 'Error al obtener personas buscadas.', error: err.message });
    }
};

// Obtener las últimas multas registradas (con info de la persona y nuevos campos de multa) para la sección pública
exports.getRecentFines = async (req, res) => {
    try {
        const recentFines = await Vehiculo.aggregate([
            // Solo vehículos que tienen al menos una multa
            { $match: { 'multas.0': { '$exists': true } } },
            // Descompone el array de multas para trabajar con cada multa individualmente
            { $unwind: '$multas' },
            // Ordena las multas por fecha descendente para obtener las más recientes
            { $sort: { 'multas.fecha': -1 } },
            // Limita a las 5 multas más recientes
            { $limit: 5 },
            // Busca el propietario para cada vehículo (basado en el ObjectId del propietario)
            {
                $lookup: {
                    from: 'personas', // Nombre de la colección de personas en MongoDB (generalmente en plural y minúsculas)
                    localField: 'propietario',
                    foreignField: '_id',
                    as: 'propietarioInfo'
                }
            },
            // Despliega el array de propietarioInfo (ya que lookup siempre devuelve un array)
            { $unwind: { path: '$propietarioInfo', preserveNullAndEmptyArrays: true } }, // preserveNullAndEmptyArrays para vehículos sin propietario
            // Proyecta los campos deseados para la respuesta final
            {
                $project: {
                    _id: 0, // No incluir el ID del vehículo
                    patente: '$patente',
                    propietario: { // Información del propietario
                        nombreCompleto: '$propietarioInfo.nombreCompleto',
                        rut: '$propietarioInfo.rut',
                        edad: '$propietarioInfo.edad' // Asegúrate de que este campo existe en tu modelo Persona
                    },
                    motivo: '$multas.motivo',
                    monto: '$multas.monto',
                    fecha: '$multas.fecha',
                    lugar: '$multas.lugar',
                    descripcion: '$multas.descripcion',
                    pagada: '$multas.pagada'
                }
            }
        ]);

        res.json(recentFines);
    } catch (err) {
        console.error("Error fetching recent fines:", err);
        res.status(500).json({ message: 'Error al obtener multas recientes.', error: err.message });
    }
};

// ... cualquier otra función en tu publicController