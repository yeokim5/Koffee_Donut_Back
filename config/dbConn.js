const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Add connection pooling and optimization options
    const conn = await mongoose.connect(process.env.DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Add connection pooling
      maxPoolSize: 10,
      minPoolSize: 5,
      // Add timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Keep alive
      keepAlive: true,
      keepAliveInitialDelay: 300000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Retry connection
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
