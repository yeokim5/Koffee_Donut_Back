// Enhanced controller to keep the backend warm and verify database connection
const mongoose = require('mongoose');

const ping = async (req, res) => {
  try {
    // Check MongoDB connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // If disconnected, mongoose will automatically try to reconnect
    
    res.status(200).json({ 
      status: "OK", 
      database: dbStatus,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: "ERROR", 
      message: error.message,
      timestamp: new Date().toISOString() 
    });
  }
};

module.exports = { ping };
