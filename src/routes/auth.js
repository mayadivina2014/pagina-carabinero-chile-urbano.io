const express = require('express');
const passport = require('passport');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args)); // Node-fetch
const router = express.Router();
const User = require('../models/User'); // Ajusta la ruta si es necesario

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_TARGET_GUILD_ID = process.env.DISCORD_TARGET_GUILD_ID;

// Función para obtener los roles de un miembro en un servidor específico
async function getGuildMemberRoles(userId) {
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_TARGET_GUILD_ID}/members/${userId}`, {
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`
            }
        });

        if (!response.ok) {
            console.warn(`❌ Error al consultar roles de Discord: ${response.status} ${response.statusText}`);
            return [];
        }

        const memberData = await response.json();
        return memberData.roles || [];
    } catch (err) {
        console.error('❌ Error al consultar roles de Discord:', err);
        return [];
    }
}

// Rutas de autenticación Discord
router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    async (req, res) => {
        if (req.user) {
            // Actualizar roles desde el servidor de Discord
            const roles = await getGuildMemberRoles(req.user.discordId);
            req.user.appRoles = roles;
            await req.user.save();
            console.log('✅ Roles actualizados:', roles);
        }
        res.redirect('/dashboard');
    }
);

// Logout
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

// Obtener datos del usuario
router.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        const { discordId, username, discriminator, avatar, guilds, appRoles } = req.user;
        res.json({ discordId, username, discriminator, avatar, guilds, appRoles });
    } else {
        res.status(401).json({ message: 'No autenticado.' });
    }
});

module.exports = router;
