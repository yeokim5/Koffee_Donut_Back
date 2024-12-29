const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
    { UserInfo: { username: foundUser.username, roles: foundUser.roles } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    { username: foundUser.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });

  res.json({ accessToken });
};

const googleLogin = async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  try {
    // Find existing user by email
    let user = await User.findOne({ email }).exec();

    if (!user) {
      // If user doesn't exist, create a new user with a temporary password
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
        authMethod: "google", // Mark user as having logged in through Google
        isTemporary: true,
      });
      await user.save();
    }

    // If the user is temporary or doesn't have a username, return a temp token
    if (user.isTemporary || !user.username) {
      const tempToken = jwt.sign(
        { userId: user._id },
        process.env.TEMP_TOKEN_SECRET,
        { expiresIn: "1m" }
      );
      return res.json({ isFirstTimeUser: true, tempToken });
    }

    // Check if the user is active
    if (!user.active) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Generate access and refresh tokens for existing active users
    const accessToken = jwt.sign(
      {
        UserInfo: {
          username: user.username,
          roles: user.roles,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
      { username: user.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    // Set the refresh token as an HttpOnly cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Return the access token
    res.json({ accessToken });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

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
        { UserInfo: { username: foundUser.username, roles: foundUser.roles } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.json({ accessToken });
    }
  );
};

const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204);
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
    path: "/",
  });
  res.json({ message: "Cookie cleared" });
};

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
      { UserInfo: { username: user.username, roles: user.roles } },
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
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { login, refresh, logout, googleLogin, setUsername };
