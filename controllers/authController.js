const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// @desc Login
// @route POST /auth
// @access Public
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const foundUser = await User.findOne({ username }).exec();

  if (!foundUser || !foundUser.active) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) return res.status(401).json({ message: "Unauthorized" });

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: foundUser.username,
        roles: foundUser.roles,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { username: foundUser.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  // Create secure cookie with refresh token
  res.cookie("jwt", refreshToken, {
    httpOnly: true, //accessible only by web server
    secure: true, //https
    sameSite: "None", //cross-site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiry: set to match rT
  });

  // Send accessToken containing username and roles
  res.json({ accessToken });
};

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" });

      const foundUser = await User.findOne({
        username: decoded.username,
      }).exec();

      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      const accessToken = jwt.sign(
        {
          UserInfo: {
            username: foundUser.username,
            roles: foundUser.roles,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );

      res.json({ accessToken });
    }
  );
};

// @desc Logout
// @route POST /auth/logout
// @access Public - just to clear cookie if exists
const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
  res.clearCookie("visitedNotes", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
  });
  res.json({ message: "Cookie cleared" });
};

const googleLogin = async (req, res) => {
  const { name, email } = req.body;

  console.log("Received Google login request:", { name, email });

  if (!name || !email) {
    console.log("Missing required fields");
    return res.status(400).json({ message: "Name and email are required" });
  }

  try {
    console.log("Checking for existing user");
    let user = await User.findOne({ email }).exec();

    if (!user) {
      console.log("Creating new user");
      const tempPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-8),
        10
      );

      user = new User({
        email,
        name,
        password: tempPassword,
        roles: ["Employee"],
        active: true,
        authMethod: "google",
        isTemporary: true,
      });

      console.log("Saving new user");
      await user.save();
    }

    if (user.isTemporary || !user.username) {
      console.log("User needs to set up username");

      if (!process.env.TEMP_TOKEN_SECRET) {
        console.error("TEMP_TOKEN_SECRET is not set in environment variables");
        return res.status(500).json({ message: "Server configuration error" });
      }

      const tempToken = jwt.sign(
        { userId: user._id },
        process.env.TEMP_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      console.log("Sending response for user needing username setup");
      return res.json({ isFirstTimeUser: true, tempToken });
    }

    console.log("Existing user with username, creating tokens");
    const accessToken = jwt.sign(
      {
        UserInfo: {
          username: user.username,
          roles: user.roles,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { username: user.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    console.log("Setting refresh token cookie");
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log("Sending response for existing user");
    res.json({ accessToken });
  } catch (error) {
    console.error("Detailed error in googleLogin:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      stack: error.stack,
    });
  }
};
// New endpoint to set username
const setUsername = async (req, res) => {
  const { username, tempToken } = req.body;

  if (!username || !tempToken) {
    return res
      .status(400)
      .json({ message: "Username and temporary token are required" });
  }

  try {
    const decoded = jwt.verify(tempToken, process.env.TEMP_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isTemporary) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    user.username = username;
    user.isTemporary = false;
    await user.save();

    const accessToken = jwt.sign(
      {
        UserInfo: {
          username: user.username,
          roles: user.roles,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { username: user.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error("Error setting username:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  login,
  refresh,
  logout,
  googleLogin,
  setUsername, // Add this new function to the exports
};
