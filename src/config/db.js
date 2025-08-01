const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // En Mongoose 6+, estas opciones ya no son necesarias y se ignoran/eliminan.
      // useCreateIndex: true,
      // useFindAndModify: false,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    // Salir del proceso con un código de error si la conexión falla
    process.exit(1);
  }
};

module.exports = connectDB;