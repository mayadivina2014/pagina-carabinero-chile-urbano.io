if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const MongoStore = require('connect-mongo');

// Modelos
const User = require('./models/User');
const Vehiculo = require('./models/Vehiculo');
const Persona = require('./models/Persona');

// Rutas
const publicRoutes = require('./routes/public');
const vehiclesRoutes = require('./routes/vehicles');
const authRoutes = require('./routes/auth');
const peopleRoutes = require('./routes/people');

const app = express();

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions', ttl: 14 * 24 * 60 * 60 }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true, secure: process.env.NODE_ENV === 'production' }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Roles y admins
const ROL_CARABINERO_ID = "1334916424694632601";
const ROL_PDI_ID = "1339366030836760671";
const ROL_MUNI_LA_FLORIDA_ID = "1339366471368835193";

const adminUserIds = process.env.DISCORD_ADMIN_USER_IDS
    ? process.env.DISCORD_ADMIN_USER_IDS.split(',').map(id => id.trim())
    : [];

const hasRole = (user, roleIds) => {
    if (!user || !user.appRoles || !Array.isArray(user.appRoles)) return false;
    const rolesToCheck = Array.isArray(roleIds) ? roleIds : [roleIds];
    return user.appRoles.some(userRoleId => rolesToCheck.includes(userRoleId));
};

// Passport Discord
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ discordId: profile.id });

        const guildId = process.env.DISCORD_TARGET_GUILD_ID;
        const targetGuild = profile.guilds.find(g => g.id === guildId);
        let appRoles = [];

        if (targetGuild && targetGuild.roles) appRoles = targetGuild.roles;
        else console.warn('⚠️ Roles no disponibles, continuando sin roles.');

        if (user) {
            user.username = profile.username;
            user.discriminator = profile.discriminator;
            user.avatar = profile.avatar;
            user.guilds = profile.guilds;
            user.appRoles = appRoles;
            await user.save();
            return done(null, user);
        } else {
            const newUser = new User({
                discordId: profile.id,
                username: profile.username,
                discriminator: profile.discriminator,
                avatar: profile.avatar,
                guilds: profile.guilds || [],
                appRoles
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (err) {
        console.error('❌ Error en autenticación Discord:', err);
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rutas públicas
app.use('/api/public', publicRoutes);
app.use('/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/people', peopleRoutes);

// Página principal
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// Dashboard con control de acceso
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');

    const isAdminById = adminUserIds.includes(req.user.discordId);
    const rolesPermitidos = [ROL_CARABINERO_ID, ROL_PDI_ID, ROL_MUNI_LA_FLORIDA_ID];
    const hasPermittedRole = hasRole(req.user, rolesPermitidos);

    if (isAdminById || hasPermittedRole) return res.sendFile(path.join(__dirname, '../public/dashboard.html'));

    const isInGuild = req.user.guilds && req.user.guilds.some(g => g.id === process.env.DISCORD_TARGET_GUILD_ID);
    if (isInGuild) {
        console.warn('⚠️ Usuario sin roles pero miembro del servidor, acceso permitido temporalmente.');
        return res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    }

    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

// Ejemplo rutas protegidas
app.get('/register-vehicle', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    if (adminUserIds.includes(req.user.discordId) || hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID]))
        return res.sendFile(path.join(__dirname, '../public/register-vehicle.html'));
    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

app.get('/register-person', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    if (adminUserIds.includes(req.user.discordId) || hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID]))
        return res.sendFile(path.join(__dirname, '../public/register-person.html'));
    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

// Más rutas de ejemplo
app.get('/search-vehicles', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    return res.sendFile(path.join(__dirname, '../public/search-vehicles.html'));
});

app.get('/search-people', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    return res.sendFile(path.join(__dirname, '../public/search-people.html'));
});

app.get('/modify-fines', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    return res.sendFile(path.join(__dirname, '../public/modify-fines.html'));
});

// Manejo de errores
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '../public/404.html')));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
