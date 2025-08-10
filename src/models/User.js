const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Definición del esquema para el modelo de usuario
const userSchema = new Schema({
    // ID único de Discord para el usuario, se usará como clave principal
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    // Nombre de usuario de Discord
    username: {
        type: String,
        required: true
    },
    // Discriminador de Discord (los 4 dígitos después del #)
    discriminator: {
        type: String,
        required: true
    },
    // URL del avatar del usuario en Discord
    avatar: {
        type: String,
        required: false // Puede ser null si el usuario no tiene avatar
    },
    // Lista de los gremios (servidores) de los que el usuario es miembro
    guilds: {
        type: Array,
        required: false
    },
    // Roles del usuario en el servidor de la aplicación (¡NUEVO CAMPO!)
    // Esto almacenará los IDs de los roles para verificar permisos
    appRoles: {
        type: [String], // Es un array de strings, ya que un usuario puede tener múltiples roles
        default: []
    },
    // Fecha de creación del documento del usuario
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Crear el modelo a partir del esquema y exportarlo
module.exports = mongoose.model('User', userSchema);
