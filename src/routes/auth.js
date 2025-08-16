const express = require('express');
const passport = require('passport');
const router = express.Router();

// Iniciar login con Discord
router.get('/discord', passport.authenticate('discord'));

// Callback después de OAuth
router.get('/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => {
    // Redirigir al dashboard aunque roles estén vacíos
    res.redirect('/dashboard');
  }
);

// Logout
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

// Información del usuario
router.get('/user', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'No autenticado.' });

  const { discordId, username, discriminator, avatar, guilds, appRoles } = req.user;

  // Devuelve también todos los servidores
  res.json({ discordId, username, discriminator, avatar, guilds, appRoles });
});

module.exports = router;
