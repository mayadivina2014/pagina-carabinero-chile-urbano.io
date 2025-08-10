//public/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    req.session.destroy(() => {
        res.redirect('/');
    });
  });
});

router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    const { discordId, username, discriminator, avatar, guilds, appRoles } = req.user;
    res.json({ discordId, username, discriminator, avatar, guilds, appRoles });
  } else {
    res.status(401).json({ message: 'No autenticado.' });
  }
});

module.exports = router;