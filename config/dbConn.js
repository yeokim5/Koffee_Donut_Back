const mongoose = require("mongoose");

// Track connection state
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("Using existing database connection");
    return;
  }

  try {
    // Add connection pooling and optimization options
    const conn = await mongoose.connect(process.env.DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Optimal connection pooling
      maxPoolSize: 10,
      minPoolSize: 5,
      // Optimize timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Keep alive
      keepAlive: true,
      keepAliveInitialDelay: 300000,
      // Allow reconnection attempts
      retryWrites: true,
      // Set read preference to nearest server for better performance
      readPreference: "nearest",
    });

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Retry connection with exponential backoff
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
