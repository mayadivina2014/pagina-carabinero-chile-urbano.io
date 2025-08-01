const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User'); // ¡IMPORTA TU NUEVO MODELO DE USUARIO AQUÍ!

// Middleware para cargar variables de entorno (asegurarse de que estén disponibles)
// Esto ya debería estar en app.js, pero no está de más en archivos que las usan directamente
require('dotenv').config();

passport.serializeUser((user, done) => {
    // Guarda solo el ID del usuario en la sesión
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    // Busca al usuario por su ID cuando se necesite
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

const TARGET_GUILD_ID = process.env.DISCORD_TARGET_GUILD_ID;
// Convertir la cadena de IDs de usuario admin a un array
const ADMIN_USER_DISCORD_IDS = process.env.DISCORD_ADMIN_USER_IDS ? process.env.DISCORD_ADMIN_USER_IDS.split(',') : [];

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds'] // Asegúrate de que estos scopes estén seleccionados en tu app de Discord
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // Buscar un usuario existente por su discordId
        let user = await User.findOne({ discordId: profile.id });

        // Verificar si el usuario está en el servidor objetivo de Discord
        const isInTargetGuild = profile.guilds.some(guild => guild.id === TARGET_GUILD_ID);

        let appRoles = ['usuario_estandar']; // Rol base por defecto para todos los usuarios

        if (isInTargetGuild) {
            appRoles.push('miembro_chile_urbano');
            // Añadir roles adicionales si está en el servidor
            appRoles.push('registrador_vehiculos');
            appRoles.push('operador_busqueda');
        }

        // Asignar el rol 'admin' de la aplicación si el ID de Discord del usuario
        // está en la lista de ADMIN_USER_DISCORD_IDS definida en tu .env
        if (ADMIN_USER_DISCORD_IDS.includes(profile.id)) {
            appRoles.push('admin');
        }

        if (user) {
            // Si el usuario ya existe, actualizar sus datos
            user.username = profile.username;
            user.discriminator = profile.discriminator;
            user.avatar = profile.avatar;
            user.guilds = profile.guilds.map(guild => ({ id: guild.id, name: guild.name }));
            user.appRoles = [...new Set(appRoles)]; // Usar Set para eliminar duplicados de roles
            await user.save();
            return done(null, user);
        } else {
            // Si el usuario no existe, crear un nuevo documento User
            user = new User({
                discordId: profile.id,
                username: profile.username,
                discriminator: profile.discriminator,
                avatar: profile.avatar,
                guilds: profile.guilds.map(guild => ({ id: guild.id, name: guild.name })),
                appRoles: [...new Set(appRoles)]
            });
            await user.save();
            return done(null, user);
        }
    } catch (err) {
        console.error("Error during Discord authentication:", err);
        return done(err, null);
    }
}));

module.exports = passport;