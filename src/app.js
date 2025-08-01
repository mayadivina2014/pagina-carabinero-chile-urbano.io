// Cargar variables de entorno al inicio de todo.
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const MongoStore = require('connect-mongo');

const connectDB = require('./config/db');

// Cargar la configuración de Passport.
require('./config/passport');

const app = express();

// ** 1. Conexión a la Base de Datos **
connectDB();

// ** 2. Middlewares de Express **
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ** 3. Servir Archivos Estáticos (Frontend) **
app.use(express.static(path.join(__dirname, '../public')));

// ** 4. Importar y Usar Rutas de la API **
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const peopleRoutes = require('./routes/people');
const publicRoutes = require('./routes/public');
// const userRoutes = require('./routes/users'); // ¡LÍNEA COMENTADA/ELIMINADA!

app.use('/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/public', publicRoutes);
// app.use('/api/users', userRoutes); // ¡LÍNEA COMENTADA/ELIMINADA!

// ** 5. Rutas de la Aplicación (Frontend - Páginas HTML) **
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/register-vehicle', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/register-vehicle.html'));
});

app.get('/search-vehicles', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search-vehicles.html'));
});

app.get('/search-people', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search-people.html'));
});

app.get('/add-fine', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/add-fine.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ** 6. Manejo de Errores **
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// ** 7. Iniciar el Servidor **
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access your app at: http://localhost:${PORT}`);
});