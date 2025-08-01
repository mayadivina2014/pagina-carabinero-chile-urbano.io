const Vehiculo = require('../models/Vehiculo');
const { Persona } = require('../models/Persona');

exports.createVehicle = async (req, res) => {
  try {
    const {
      nombreCompleto,
      rut,
      edad,
      tipo_vehiculo,
      marca,
      modelo,
      patente,
      color,
      anio,
      imagen_url
    } = req.body;

    let propietario;
    if (rut) {
      propietario = await Persona.findOne({ rut: rut });
      if (!propietario) {
        propietario = new Persona({ nombreCompleto, rut, edad });
        await propietario.save();
      } else {
        // Actualizar información del propietario si ya existe
        if (nombreCompleto) propietario.nombreCompleto = nombreCompleto;
        if (edad) propietario.edad = edad;
        await propietario.save();
      }
    }

    const newVehicle = new Vehiculo({
      marca,
      modelo,
      patente: patente.toUpperCase(), // Asegura que la patente se guarde en mayúsculas
      tipo_vehiculo,
      color,
      anio,
      imagen_url,
      propietario: propietario ? propietario._id : undefined
    });

    await newVehicle.save();
    const vehicleWithPopulatedOwner = await Vehiculo.findById(newVehicle._id).populate('propietario', 'nombreCompleto rut edad');

    res.status(201).json(vehicleWithPopulatedOwner);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: 'La patente ya está registrada para otro vehículo.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al crear el vehículo.', error: err.message });
  }
};

// Función de búsqueda general de vehículos, soporta query para filtrar
exports.getAllVehicles = async (req, res) => {
  try {
    const { query } = req.query;
    let filter = {};

    if (query) {
      const searchRegex = new RegExp(query, 'i');
      filter = {
        $or: [
          { patente: searchRegex },
          { marca: searchRegex },
          { modelo: searchRegex }
        ]
      };
    }

    const vehicles = await Vehiculo.find(filter).populate('propietario', 'nombreCompleto rut edad');
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Error interno del servidor al obtener vehículos.', error: err.message });
  }
};


exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehiculo.findById(req.params.id).populate('propietario', 'nombreCompleto rut edad');
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }
    res.json(vehicle);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de vehículo inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al obtener el vehículo.', error: err.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    // Si se actualiza la patente, asegúrate de que esté en mayúsculas
    if (req.body.patente) {
        req.body.patente = req.body.patente.toUpperCase();
    }
    const updatedVehicle = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('propietario', 'nombreCompleto rut edad');

    if (!updatedVehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }
    res.json(updatedVehicle);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de vehículo inválido.' });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
        return res.status(409).json({ message: 'La patente ya está registrada para otro vehículo.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al actualizar el vehículo.', error: err.message });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const deletedVehicle = await Vehiculo.findByIdAndDelete(req.params.id);
    if (!deletedVehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }
    res.json({ message: 'Vehículo eliminado correctamente.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de vehículo inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al eliminar el vehículo.', error: err.message });
  }
};

exports.toggleBuscado = async (req, res) => {
    try {
        const vehicle = await Vehiculo.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }

        vehicle.buscado = !vehicle.buscado;
        await vehicle.save();
        res.json(vehicle);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Formato de ID de vehículo inválido.' });
        }
        res.status(500).json({ message: 'Error interno del servidor al cambiar el estado de buscado.', error: err.message });
    }
};

// ** Actualización de la función para añadir multas a un vehículo **
exports.addFineToVehicle = async (req, res) => {
  try {
    const { patente, motivo, lugar, monto, descripcion } = req.body; // Ahora recibe patente en el cuerpo

    // Busca el vehículo por patente
    const vehicle = await Vehiculo.findOne({ patente: patente.toUpperCase() });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado con la patente proporcionada.' });
    }

    // Crea la nueva multa con los nuevos campos
    const newFine = {
      descripcion: descripcion || 'Multa sin descripción detallada',
      motivo: motivo || 'Motivo no especificado',
      lugar: lugar || 'Lugar no especificado',
      monto: monto
    };

    vehicle.multas.push(newFine);
    await vehicle.save();

    // Popula el propietario para la respuesta
    const vehicleWithPopulatedOwner = await Vehiculo.findById(vehicle._id).populate('propietario', 'nombreCompleto rut edad');

    res.status(200).json({ message: 'Multa agregada exitosamente.', vehicle: vehicleWithPopulatedOwner });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error interno del servidor al añadir multa.', error: err.message });
  }
};

// ** NUEVA FUNCIÓN: Marcar multa como pagada **
exports.markFineAsPaid = async (req, res) => {
  try {
    const { vehicleId, fineId } = req.params;

    const vehicle = await Vehiculo.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }

    const fine = vehicle.multas.id(fineId); // Busca la multa por su _id anidado
    if (!fine) {
      return res.status(404).json({ message: 'Multa no encontrada en este vehículo.' });
    }

    fine.pagada = true; // Marcar como pagada
    await vehicle.save();

    res.status(200).json({ message: 'Multa marcada como pagada.', fine });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'ID de vehículo o multa inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al marcar multa como pagada.', error: err.message });
  }
};

// ** NUEVA FUNCIÓN: Editar multa (monto y estado de pagada) **
exports.editFine = async (req, res) => {
  try {
    const { vehicleId, fineId } = req.params;
    const { monto, pagada } = req.body; // Solo permitimos editar monto y pagada

    const vehicle = await Vehiculo.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }

    const fine = vehicle.multas.id(fineId);
    if (!fine) {
      return res.status(404).json({ message: 'Multa no encontrada en este vehículo.' });
    }

    // Actualizar solo los campos permitidos
    if (monto !== undefined) {
      fine.monto = monto;
    }
    if (pagada !== undefined) {
      fine.pagada = pagada;
    }

    await vehicle.save();
    res.status(200).json({ message: 'Multa actualizada exitosamente.', fine });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'ID de vehículo o multa inválido.' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error interno del servidor al editar multa.', error: err.message });
  }
};