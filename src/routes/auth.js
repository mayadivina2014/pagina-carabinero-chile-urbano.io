// routes/auth.js
const express = require('express');
const passport = require('passport');
const fetch = require('node-fetch');
const router = express.Router();
const User = require('../models/User');

// Función para obtener roles desde la API de Discord usando el bot token
async function getGuildMemberRoles(discordId) {
    const guildId = process.env.DISCORD_TARGET_GUILD_ID;
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`;

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        if (!res.ok) {
            console.warn(`⚠️ No se pudo obtener roles para el usuario ${discordId}. Status: ${res.status}`);
            return [];
        }

        const member = await res.json();
        return member.roles || [];
    } catch (err) {
        console.error('❌ Error al consultar roles de Discord:', err);
        return [];
    }
}

// Ruta de login con Discord
router.get('/discord', passport.authenticate('discord'));

// Callback de Discord
router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    async (req, res) => {
        try {
            // Obtener roles desde Discord usando el bot token
            const roles = await getGuildMemberRoles(req.user.discordId);
            req.user.appRoles = roles;
            await req.user.save();
            console.log('✅ Roles actualizados:', roles);

            res.redirect('/dashboard');
        } catch (err) {
            console.error('❌ Error en callback de Discord:', err);
            res.redirect('/');
        }
    }
);

// Logout
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(() => res.redirect('/'));
    });
});

// Obtener info del usuario autenticado
router.get('/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'No autenticado.' });

    const { discordId, username, discriminator, avatar, guilds, appRoles } = req.user;
    res.json({ discordId, username, discriminator, avatar, guilds, appRoles });
});

module.exports = router;
