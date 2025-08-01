const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    discriminator: {
        type: String,
        required: true
    },
    avatar: {
        type: String
    },
    guilds: [{ // Para almacenar los IDs y nombres de los servidores de Discord a los que pertenece
        id: String,
        name: String
    }],
    appRoles: { // Roles que tu aplicación asigna (ej. admin, registrador_vehiculos)
        type: [String],
        default: ['usuario_estandar']
    }
}, {
    timestamps: true // Para createdAt y updatedAt
});

const User = mongoose.model('User', userSchema);

module.exports = User;