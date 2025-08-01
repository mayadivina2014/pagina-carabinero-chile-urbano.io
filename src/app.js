// Cargar variables de entorno al principio para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const MongoStore = require('connect-mongo'); // Para almacenar sesiones en MongoDB

// Importar modelos (asegúrate de que los paths sean correctos)
const User = require('./models/User'); // Asumiendo que tienes un modelo User para la autenticación
const Vehiculo = require('./models/Vehiculo'); // Importar el modelo Vehiculo
const Persona = require('./models/Persona'); // Importar el modelo Persona

// Importar rutas existentes y confirmadas
const publicRoutes = require('./routes/public'); // Rutas para la información pública
const vehiclesRoutes = require('./routes/vehicles'); // Rutas para vehículos (GET, POST, PUT, DELETE, y multas)
const authRoutes = require('./routes/auth'); // Rutas de autenticación (Discord)

// Las siguientes rutas están comentadas porque no tienes los archivos .js correspondientes en src/routes/
// const dashboardRoutes = require('./routes/dashboard'); // Rutas para el dashboard
// const registerVehicleRoutes = require('./routes/register-vehicle'); // Rutas para registrar vehículos
// const registerPersonRoutes = require('./routes/register-person'); // Rutas para registrar personas


const app = express();

// ** Conexión a la base de datos MongoDB **
// La URI de conexión se toma de las variables de entorno
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.error('MongoDB connection error:', err));


// ** Middlewares **
app.use(express.json()); // Para parsear JSON en el cuerpo de las peticiones
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios URL-encoded

// Configuración de sesiones (usando connect-mongo para persistencia)
app.use(session({
    secret: process.env.SESSION_SECRET, // Usa una cadena larga y segura de tus variables de entorno
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions', // Nombre de la colección donde se guardarán las sesiones
        ttl: 14 * 24 * 60 * 60 // 14 días (tiempo de vida de la sesión)
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días (milisegundos)
        httpOnly: true, // Las cookies no son accesibles a través de JavaScript del lado del cliente
        secure: process.env.NODE_ENV === 'production' // Solo envía la cookie sobre HTTPS en producción
    }
}));


// ** Configuración de Passport (Autenticación Discord) **
app.use(passport.initialize());
app.use(passport.session());

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds'] // Puedes ajustar los scopes según tus necesidades
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ discordId: profile.id });

        if (user) {
            // Actualizar datos del usuario si ya existe
            user.username = profile.username;
            user.discriminator = profile.discriminator;
            user.avatar = profile.avatar;
            user.guilds = profile.guilds; // Guardar los gremios si se solicita en el scope
            await user.save();
            return done(null, user);
        } else {
            // Crear nuevo usuario
            const newUser = new User({
                discordId: profile.id,
                username: profile.username,
                discriminator: profile.discriminator,
                avatar: profile.avatar,
                guilds: profile.guilds || [],
                // Puedes añadir otros campos que necesites de Discord profile
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (err) {
        console.error("Error during Discord authentication:", err);
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});


// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, '../public')));


// ** Rutas de la aplicación **
// Ruta principal (index)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rutas de información pública (dashboard público)
// ¡CAMBIO IMPORTANTE AQUÍ! Ahora las rutas del public.js serán accesibles bajo /api/public
app.use('/api/public', publicRoutes);

// Rutas de autenticación
app.use('/auth', authRoutes);

// Rutas directas para las páginas HTML que no tienen archivos .js de ruta dedicados
// Estas rutas requieren autenticación para acceder a la página HTML
app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

app.get('/register-vehicle', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/register-vehicle.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

app.get('/register-person', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/register-person.html'));
    } else {
        res.redirect('/auth/discord');
    }
});

// Rutas para buscar vehículos (la página en sí)
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


// Rutas API (generalmente con prefijo /api)
app.use('/api/vehicles', vehiclesRoutes); // Todas las rutas de API para vehículos y multas
// Puedes añadir más rutas API aquí, ej:
// app.use('/api/people', peopleRoutes);


// Manejo de errores 404
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html')); // Asegúrate de tener un 404.html
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});


// ** Inicio del servidor **
const PORT = process.env.PORT || 3000; // Usa el puerto proporcionado por el entorno o 3000 localmente

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access your app at: http://localhost:${PORT}`);
});