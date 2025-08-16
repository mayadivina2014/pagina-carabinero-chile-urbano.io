// Cargar variables de entorno al principio
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

// Importar modelos
const User = require('./models/User');
const Vehiculo = require('./models/Vehiculo');
const Persona = require('./models/Persona');

// Importar rutas
const publicRoutes = require('./routes/public');
const vehiclesRoutes = require('./routes/vehicles');
const authRoutes = require('./routes/auth');
const peopleRoutes = require('./routes/people');

const app = express();

// ** Conexión a la base de datos MongoDB **
const mongoURI = process.env.MONGO_URI;

console.log('Intentando conectar a MongoDB...');
mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected...'))
    .catch(err => console.error('❌ MongoDB connection error:', err));


// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Configuración de Passport
app.use(passport.initialize());
app.use(passport.session());

// Variables de roles
const ROL_CARABINERO_ID = "1334916424694632601";
const ROL_PDI_ID = "1339366030836760671";
const ROL_MUNI_LA_FLORIDA_ID = "1339366471368835193";

// Parsear IDs de administradores desde las variables de entorno
const adminUserIds = process.env.DISCORD_ADMIN_USER_IDS
    ? process.env.DISCORD_ADMIN_USER_IDS.split(',').map(id => id.trim())
    : [];

// Función para verificar si el usuario tiene al menos uno de los roles permitidos
const hasRole = (user, roleIds) => {
    if (!user || !user.appRoles || !Array.isArray(user.appRoles)) {
        return false;
    }
    const rolesToCheck = Array.isArray(roleIds) ? roleIds : [roleIds];
    return user.appRoles.some(userRoleId => rolesToCheck.includes(userRoleId));
};

// ==============================
// Passport Discord Strategy
// ==============================
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds', 'guilds.members.read']
},
async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('➡️ Passport Discord Strategy: Callback recibido.');
        console.log('   Discord ID:', profile.id);

        // DEBUG: mostrar todas las guilds que llegan
        console.log("🔹 Guilds recibidas por Passport:", profile.guilds);

        // Buscar usuario en DB
        let user = await User.findOne({ discordId: profile.id });

        // Extraer roles del servidor específico
        let appRoles = [];
        const guildId = process.env.DISCORD_TARGET_GUILD_ID;
        const targetGuild = profile.guilds.find(g => g.id === guildId);

        if (targetGuild) {
            if (targetGuild.roles && targetGuild.roles.length > 0) {
                appRoles = targetGuild.roles;
                console.log('✅ Roles encontrados en el servidor:', appRoles);
            } else {
                console.log('⚠️ Usuario es miembro del servidor, pero no tiene roles o no se pudieron obtener.');
            }
        } else {
            console.log('⚠️ Usuario no es miembro del servidor o guild no encontrada.');
        }

        if (user) {
            console.log('✅ Usuario encontrado en la base de datos:', user.username);
            // Actualizar datos y roles
            user.username = profile.username;
            user.discriminator = profile.discriminator;
            user.avatar = profile.avatar;
            user.guilds = profile.guilds;
            user.appRoles = appRoles;
            await user.save();
            console.log('✅ Usuario actualizado y guardado. Roles guardados:', user.appRoles);
            return done(null, user);
        } else {
            console.log('➕ Usuario no encontrado. Creando nuevo usuario...');
            const newUser = new User({
                discordId: profile.id,
                username: profile.username,
                discriminator: profile.discriminator,
                avatar: profile.avatar,
                guilds: profile.guilds || [],
                appRoles: appRoles,
            });
            await newUser.save();
            console.log('✅ Nuevo usuario creado y guardado. Roles guardados:', newUser.appRoles);
            return done(null, newUser);
        }
    } catch (err) {
        console.error("❌ Error grave durante la autenticación de Discord:", err);
        return done(err, null);
    }
}));

// Debug extra en serialize/deserialize
passport.serializeUser((user, done) => {
    console.log("🔹 [serializeUser] Guardando en sesión el ID:", user._id.toString());
    done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
    console.log("🔹 [deserializeUser] Intentando buscar usuario con ID:", id);
    try {
        const user = await User.findById(id);
        if (user) {
            console.log("✅ [deserializeUser] Usuario encontrado:", user.username, "#"+user.discriminator);
            done(null, user);
        } else {
            console.warn("⚠️ [deserializeUser] No se encontró usuario con ese ID en la base de datos.");
            done(null, null);
        }
    } catch (err) {
        console.error("❌ [deserializeUser] Error buscando usuario:", err);
        done(err, null);
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de la aplicación
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Usar los routers
app.use('/api/public', publicRoutes);
app.use('/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/people', peopleRoutes);

// Ruta Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');

    console.log('Usuario autenticado con Discord ID:', req.user.discordId);

    if (adminUserIds.includes(req.user.discordId)) {
        console.log('✅ Acceso concedido al dashboard por ID de administrador.');
        return res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    }

    const rolesPermitidos = [ROL_CARABINERO_ID, ROL_PDI_ID, ROL_MUNI_LA_FLORIDA_ID];

    if (hasRole(req.user, rolesPermitidos)) {
        console.log('✅ Acceso concedido al dashboard por rol autorizado.');
        return res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    }

    console.warn('❌ Acceso denegado al dashboard. El usuario no tiene los permisos requeridos.');
    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

// Ejemplos de rutas protegidas
app.get('/register-vehicle', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');

    if (adminUserIds.includes(req.user.discordId) ||
        hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID])) {
        return res.sendFile(path.join(__dirname, '../public/register-vehicle.html'));
    }
    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

app.get('/register-person', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');

    if (adminUserIds.includes(req.user.discordId) ||
        hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID])) {
        return res.sendFile(path.join(__dirname, '../public/register-person.html'));
    }
    return res.status(403).sendFile(path.join(__dirname, '../public/403.html'));
});

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

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access your app at: http://localhost:${PORT}`);
});
