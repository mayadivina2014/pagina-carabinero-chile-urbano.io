const { Persona } = require('../models/Persona');

exports.createPersona = async (req, res) => {
  try {
    const newPersona = new Persona(req.body);
    await newPersona.save();
    res.status(201).json(newPersona);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: 'El RUT ya está registrado para otra persona.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al crear la persona.', error: err.message });
  }
};

exports.getAllPersonas = async (req, res) => {
  try {
    const personas = await Persona.find();
    res.json(personas);
  }
  catch (err) {
    res.status(500).json({ message: 'Error interno del servidor al obtener personas.', error: err.message });
  }
};

exports.getPersonaById = async (req, res) => {
  try {
    const persona = await Persona.findById(req.params.id);
    if (!persona) {
      return res.status(404).json({ message: 'Persona no encontrada.' });
    }
    res.json(persona);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de persona inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al obtener la persona.', error: err.message });
  }
};

exports.updatePersona = async (req, res) => {
  try {
    const updatedPersona = await Persona.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedPersona) {
      return res.status(404).json({ message: 'Persona no encontrada.' });
    }
    res.json(updatedPersona);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de persona inválido.' });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
        return res.status(409).json({ message: 'El RUT ya está registrado para otra persona.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al actualizar la persona.', error: err.message });
  }
};

exports.deletePersona = async (req, res) => {
  try {
    // Primero, verifica si la persona es propietaria de algún vehículo.
    // Esto es importante para evitar vehículos sin propietario.
    // Aunque puedes optar por eliminar vehículos asociados o desvincularlos.
    // Por simplicidad, aquí solo eliminaremos la persona si no es propietario.
    // Una implementación más robusta podría:
    // 1. Eliminar vehículos (cascada)
    // 2. Desvincular vehículos (set propietario a null)
    // 3. Impedir la eliminación si es propietario y pedir una acción específica
    const Vehiculo = require('../models/Vehiculo'); // Importa el modelo de Vehiculo aquí
    const vehiclesOwned = await Vehiculo.countDocuments({ propietario: req.params.id });

    if (vehiclesOwned > 0) {
      return res.status(400).json({ message: 'No se puede eliminar la persona porque es propietaria de uno o más vehículos. Desvincula o elimina los vehículos primero.' });
    }

    const deletedPersona = await Persona.findByIdAndDelete(req.params.id);
    if (!deletedPersona) {
      return res.status(404).json({ message: 'Persona no encontrada.' });
    }
    res.json({ message: 'Persona eliminada correctamente.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de persona inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al eliminar la persona.', error: err.message });
  }
};

exports.searchPersonas = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            const personas = await Persona.find({});
            return res.json(personas);
        }

        const searchRegex = new RegExp(query, 'i');
        const personas = await Persona.find({
            $or: [
                { nombreCompleto: searchRegex },
                { rut: searchRegex },
                { motivo_busqueda: searchRegex },
                { lugar_busqueda: searchRegex }
            ]
        });
        res.json(personas);
    } catch (err) {
        res.status(500).json({ message: 'Error interno del servidor al buscar personas.', error: err.message });
    }
};

// ** NUEVA FUNCIÓN: Quitar persona de 'buscada' **
exports.unmarkPersonWanted = async (req, res) => {
  try {
    const updatedPersona = await Persona.findByIdAndUpdate(
      req.params.id,
      {
        $unset: { // $unset elimina el campo
          motivo_busqueda: "",
          descripcion_fisica: "",
          lugar_busqueda: ""
        }
      },
      { new: true } // Devolver el documento actualizado
    );

    if (!updatedPersona) {
      return res.status(404).json({ message: 'Persona no encontrada.' });
    }
    res.json({ message: 'Persona marcada como no buscada.', persona: updatedPersona });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Formato de ID de persona inválido.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al quitar persona de buscada.', error: err.message });
  }
};