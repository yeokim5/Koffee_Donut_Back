// Simple controller to keep the backend warm
const ping = (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
};

module.exports = { ping };
