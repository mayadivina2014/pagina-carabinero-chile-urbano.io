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

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    // ¡Nuevos permisos aquí!
    scope: ['identify', 'guilds', 'guilds.members.read']
},
async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('➡️ Passport Discord Strategy: Callback recibido.');
        console.log('   Discord ID:', profile.id);
        
        let user = await User.findOne({ discordId: profile.id });

        // Extraer roles del servidor específico
        let appRoles = [];
        const guildId = process.env.DISCORD_GUILD_ID;
        const targetGuild = profile.guilds.find(g => g.id === guildId);

        if (targetGuild && targetGuild.roles) {
            appRoles = targetGuild.roles;
            console.log('✅ Roles encontrados en el servidor:', appRoles);
        } else {
            console.warn('⚠️ Usuario no es miembro del servidor o no se encontraron roles.');
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

passport.serializeUser((user, done) => {
    console.log('➡️ Serializando usuario:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('⬅️ Deserializando usuario por ID:', id);
        const user = await User.findById(id);
        if (user) {
            console.log('✅ Usuario deserializado exitosamente:', user.username);
        } else {
            console.error('❌ Error: Usuario no encontrado durante la deserialización.');
        }
        done(null, user);
    } catch (err) {
        console.error('❌ Error durante la deserialización:', err);
        done(err, null);
    }
});


// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));


// ** Constantes para los IDs de roles **
// NOTA: Es importante que estos IDs coincidan exactamente con los de tu servidor de Discord
const ROL_CARABINERO_ID = "1334916424694632601";
const ROL_PDI_ID = "1339366030836760671";
const ROL_MUNI_LA_FLORIDA_ID = "1339366471368835193";

// ** Helper para verificar roles (mejorado para manejar múltiples roles) **
const hasRole = (user, roleIds) => {
    if (!user || !user.appRoles || !Array.isArray(user.appRoles)) {
        return false;
    }
    // Asegurarse de que roleIds sea siempre un array
    const rolesToCheck = Array.isArray(roleIds) ? roleIds : [roleIds];
    return user.appRoles.some(userRoleId => rolesToCheck.includes(userRoleId));
};


// ** Rutas de la aplicación (con chequeo de roles mejorado) **
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use('/api/public', publicRoutes);
app.use('/auth', authRoutes);

app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        // Verificar si el usuario tiene AL MENOS UNO de los roles permitidos
        const rolesPermitidos = [ROL_CARABINERO_ID, ROL_PDI_ID, ROL_MUNI_LA_FLORIDA_ID];
        if (hasRole(req.user, rolesPermitidos)) {
            res.sendFile(path.join(__dirname, '../public/dashboard.html'));
        } else {
            res.status(403).sendFile(path.join(__dirname, '../public/403.html')); // Acceso denegado
        }
    } else {
        res.redirect('/auth/discord');
    }
});

// Puedes aplicar la misma lógica a otras rutas que requieren permisos, por ejemplo:
app.get('/register-vehicle', (req, res) => {
    if (req.isAuthenticated() && hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID])) {
        res.sendFile(path.join(__dirname, '../public/register-vehicle.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

app.get('/register-person', (req, res) => {
    if (req.isAuthenticated() && hasRole(req.user, [ROL_CARABINERO_ID, ROL_PDI_ID])) {
        res.sendFile(path.join(__dirname, '../public/register-person.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

// El resto de las rutas que revisan isAuthenticated() se mantienen igual por ahora
app.get('/search-vehicles', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/search-vehicles.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

app.get('/modify-fines', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/modify-fines.html'));
    } else {
        res.redirect('/auth/discord');
    }
});


app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/people', peopleRoutes);


// Manejo de errores 404
app.use((req, res, next) => {
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
