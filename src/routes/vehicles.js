const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');
const Persona = require('../models/Persona'); // Necesario para buscar propietarios


// Middleware de autenticación (ejemplo, puedes ajustarlo según tus necesidades)
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'No autorizado. Por favor, inicia sesión.' });
};

// ** Rutas para Vehículos **

// 1. Obtener todos los vehículos (GET /api/vehicles)
router.get('/', async (req, res) => { // Puedes añadir ensureAuthenticated aquí si quieres proteger esta ruta
    try {
        const vehicles = await Vehiculo.find().populate('propietario'); // Popula los datos del propietario
        res.json(vehicles);
    } catch (err) {
        console.error('Error al obtener vehículos:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener vehículos.', error: err.message });
    }
});

// 2. Buscar vehículos por patente o propietario (GET /api/vehicles/search?query=...)
// ¡IMPORTANTE: Esta ruta de búsqueda debe ir ANTES de cualquier ruta que use /:id!
router.get('/search', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'El parámetro de búsqueda "query" es requerido.' });
        }

        const searchRegex = new RegExp(query, 'i'); // Búsqueda insensible a mayúsculas/minúsculas

        // Buscar vehículos por patente
        const vehiclesByPatente = await Vehiculo.find({ patente: searchRegex }).populate('propietario');

        // Buscar personas por nombre completo o RUT
        const peopleBySearch = await Persona.find({
            $or: [
                { nombreCompleto: searchRegex },
                { rut: searchRegex }
            ]
        });

        // Obtener IDs de vehículos asociados a las personas encontradas
        const vehicleIdsFromPeople = await Vehiculo.find({ propietario: { $in: peopleBySearch.map(p => p._id) } }).populate('propietario');

        // Combinar resultados y eliminar duplicados (usando ID de vehículo)
        const combinedResultsMap = new Map();
        vehiclesByPatente.forEach(v => combinedResultsMap.set(v._id.toString(), v));
        vehicleIdsFromPeople.forEach(v => combinedResultsMap.set(v._id.toString(), v));

        const vehicles = Array.from(combinedResultsMap.values());

        if (vehicles.length === 0) {
            return res.status(404).json({ message: 'No se encontraron vehículos que coincidan con la búsqueda.' });
        }

        res.json(vehicles);
    } catch (err) {
        console.error('Error al buscar vehículos:', err);
        res.status(500).json({ message: 'Error interno del servidor al buscar vehículos.', error: err.message });
    }
});


// 3. Obtener un vehículo por ID (GET /api/vehicles/:id)
// Esta ruta debe ir DESPUÉS de la ruta /search para evitar conflictos
router.get('/:id', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const vehicle = await Vehiculo.findById(req.params.id); // No populamos propietario aquí si solo necesitamos el vehículo
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }
        res.json(vehicle);
    } catch (err) {
        console.error('Error al obtener vehículo por ID:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de vehículo inválido.', error: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al obtener vehículo.', error: err.message });
    }
});

// 4. Crear un nuevo vehículo (POST /api/vehicles)
router.post('/', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const { patente, marca, modelo, anio, color, propietarioRut, imagen_url } = req.body;

        // Validar campos requeridos
        if (!patente || !marca || !modelo || !anio || !color || !propietarioRut) {
            return res.status(400).json({ message: 'Todos los campos obligatorios (patente, marca, modelo, año, color, RUT del propietario) son requeridos.' });
        }

        // Buscar si el propietario ya existe
        let propietario = await Persona.findOne({ rut: propietarioRut });

        if (!propietario) {
            // Si el propietario no existe, devuelve un error.
            // La creación de personas debería manejarse en una ruta separada (ej: POST /api/people)
            return res.status(400).json({ message: 'Propietario no encontrado con el RUT proporcionado. Por favor, asegúrese de que el propietario exista o regístrelo primero.' });
        }

        // Verificar si ya existe un vehículo con esa patente
        const existingVehicle = await Vehiculo.findOne({ patente: patente.toUpperCase() });
        if (existingVehicle) {
            return res.status(409).json({ message: 'Ya existe un vehículo registrado con esta patente.' });
        }

        const newVehicle = new Vehiculo({
            patente: patente.toUpperCase(), // Guardar patente en mayúsculas
            marca,
            modelo,
            anio,
            color,
            propietario: propietario._id, // Asigna solo el ID del propietario
            imagen_url: imagen_url || 'https://via.placeholder.com/150' // URL por defecto si no se proporciona
        });

        await newVehicle.save();
        // Popula el propietario en la respuesta para el cliente
        const savedVehicle = await Vehiculo.findById(newVehicle._id).populate('propietario');
        res.status(201).json({ message: 'Vehículo registrado con éxito.', vehicle: savedVehicle });

    } catch (err) {
        console.error('Error al registrar vehículo:', err);
        if (err.name === 'ValidationError') {
            // Mongoose Validation Error (ej. patente requerida)
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al registrar vehículo.', error: err.message });
    }
});

// 5. Actualizar un vehículo (PUT /api/vehicles/:id)
router.put('/:id', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const { patente, marca, modelo, anio, color, propietarioRut, imagen_url } = req.body;
        const updates = { patente, marca, modelo, anio, color, imagen_url };

        // Si se proporciona propietarioRut, buscar al propietario
        if (propietarioRut) {
            const propietario = await Persona.findOne({ rut: propietarioRut });
            if (!propietario) {
                return res.status(404).json({ message: 'Propietario no encontrado con el RUT proporcionado.' });
            }
            updates.propietario = propietario._id;
        }

        // Si se actualiza la patente, asegúrate de que esté en mayúsculas
        if (updates.patente) {
            updates.patente = updates.patente.toUpperCase();
            // Además, verificar si la nueva patente ya existe en otro vehículo
            const existingVehicle = await Vehiculo.findOne({ patente: updates.patente, _id: { $ne: req.params.id } });
            if (existingVehicle) {
                return res.status(409).json({ message: 'Ya existe otro vehículo registrado con esta patente.' });
            }
        }

        const updatedVehicle = await Vehiculo.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true } // new: true devuelve el documento actualizado; runValidators: true para ejecutar validaciones del esquema
        ).populate('propietario');

        if (!updatedVehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado para actualizar.' });
        }

        res.json({ message: 'Vehículo actualizado con éxito.', vehicle: updatedVehicle });
    } catch (err) {
        console.error('Error al actualizar vehículo:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de vehículo inválido para actualizar.', error: err.message });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al actualizar vehículo.', error: err.message });
    }
});

// 6. Eliminar un vehículo (DELETE /api/vehicles/:id)
router.delete('/:id', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const deletedVehicle = await Vehiculo.findByIdAndDelete(req.params.id);
        if (!deletedVehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado para eliminar.' });
        }
        res.json({ message: 'Vehículo eliminado con éxito.', vehicle: deletedVehicle });
    } catch (err) {
        console.error('Error al eliminar vehículo:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de vehículo inválido para eliminar.', error: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al eliminar vehículo.', error: err.message });
    }
});


// ** Rutas para Multas **

// 7. Añadir una multa a un vehículo por PATENTE (POST /api/vehicles/fines)
// La patente del vehículo ahora se espera en el cuerpo de la solicitud (req.body.patente)
router.post('/fines', async (req, res) => { // Puedes añadir ensureAuthenticated aquí si quieres
    try {
        // Extrae la patente y los datos de la multa del cuerpo de la solicitud
        const { patente, motivo, monto, lugar, descripcion } = req.body;

        // Validar campos requeridos de la multa
        if (!patente || !motivo || !monto || !lugar) {
            return res.status(400).json({ message: 'Patente, motivo, monto y lugar son campos requeridos para la multa.' });
        }
        if (isNaN(monto) || monto < 0) {
            return res.status(400).json({ message: 'El monto de la multa debe ser un número positivo.' });
        }

        // Buscar el vehículo por su patente
        const vehicle = await Vehiculo.findOne({ patente: patente.toUpperCase() });

        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado con la patente proporcionada.' });
        }

        const newFine = {
            motivo,
            monto,
            fecha: new Date(), // Usa la fecha actual del servidor
            lugar,
            descripcion: descripcion || '', // La descripción es opcional
            pagada: false // Por defecto, una multa nueva no está pagada
        };

        vehicle.multas.push(newFine); // Mongoose asignará automáticamente un _id a este subdocumento
        await vehicle.save(); // Guarda el vehículo para persistir la multa

        // Devuelve la multa con su _id generado
        // Se devuelve la última multa añadida, que es la que acabamos de crear
        res.status(201).json({ message: 'Multa añadida con éxito.', fine: vehicle.multas[vehicle.multas.length - 1] });
    } catch (err) {
        console.error('Error al añadir multa:', err);
        // Manejo específico para errores de validación de Mongoose en la multa
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al añadir multa.', error: err.message });
    }
});


// 8. Obtener todas las multas de un vehículo (GET /api/vehicles/:id/fines)
router.get('/:id/fines', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const vehicle = await Vehiculo.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }
        res.json(vehicle.multas);
    } catch (err) {
        console.error('Error al obtener multas del vehículo:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener multas.', error: err.message });
    }
});

// 9. Actualizar una multa específica (PUT /api/vehicles/:vehicleId/fines/:fineId)
// Esta ruta reemplaza la funcionalidad de 'pagar multa' y permite actualizar todos los campos
router.put('/:vehicleId/fines/:fineId', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const { vehicleId, fineId } = req.params;
        const { motivo, monto, lugar, descripcion, fecha, pagada } = req.body;

        const vehicle = await Vehiculo.findById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }

        const fine = vehicle.multas.id(fineId); // Busca el subdocumento de multa por su _id
        if (!fine) {
            return res.status(404).json({ message: 'Multa no encontrada en este vehículo.' });
        }

        // Actualiza los campos de la multa
        fine.motivo = motivo;
        fine.monto = monto;
        fine.lugar = lugar;
        fine.descripcion = descripcion;
        fine.fecha = new Date(fecha); // Asegúrate de que la fecha se guarde como tipo Date
        fine.pagada = pagada;

        await vehicle.save(); // Guarda el vehículo para persistir los cambios en la multa

        res.json({ message: 'Multa actualizada con éxito.', fine });
    } catch (err) {
        console.error('Error al actualizar multa:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de vehículo o multa inválido.', error: err.message });
        }
        if (err.name === 'ValidationError') { // Captura errores de validación de Mongoose (ej. monto negativo)
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al actualizar multa.', error: err.message });
    }
});


// 10. Eliminar una multa (DELETE /api/vehicles/:vehicleId/fines/:fineId)
router.delete('/:vehicleId/fines/:fineId', async (req, res) => { // Puedes añadir ensureAuthenticated aquí
    try {
        const vehicle = await Vehiculo.findById(req.params.vehicleId);
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }

        // Usamos pull para eliminar el subdocumento por su _id
        vehicle.multas.pull({ _id: req.params.fineId });
        await vehicle.save(); // Guardar el cambio

        res.json({ message: 'Multa eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar multa:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID de vehículo o multa inválido.', error: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al eliminar multa.', error: err.message });
    }
});


module.exports = router;