const User = require("../models/User");
const Note = require("../models/Note");
const bcrypt = require("bcrypt");
const axios = require("axios");

// @desc Get all users
// @route GET /users
// @access Private
const getAllUsers = async (req, res) => {
  // Get all users from MongoDB
  const users = await User.find().select("-password -email").lean(); // Exclude password and email

  // If no users
  if (!users?.length) {
    return res.status(400).json({ message: "No users found" });
  }

  res.json(users);
};

// @desc Create new user
// @route POST /users
// @access Private
const createNewUser = async (req, res) => {
  const { username, password, roles, email, recaptchaValue } = req.body;

  // Confirm data
  if (!username || !password || !recaptchaValue) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Verify reCAPTCHA
  try {
    const recaptchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaValue}`
    );

    if (!recaptchaResponse.data.success) {
      return res.status(400).json({ message: "reCAPTCHA verification failed" });
    }
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(500).json({ message: "Error verifying reCAPTCHA" });
  }

  // Check for duplicate username
  const duplicate = await User.findOne({ username }).lean().exec();

  if (duplicate) {
    return res.status(409).json({ message: "Duplicate username" });
  }

  // Hash password
  const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

  const userObject = {
    username,
    password: hashedPwd,
    roles,
    authMethod: "local",
  };

  // Only add email if it's provided
  if (email) {
    userObject.email = email;
  }

  // Create and store new user
  try {
    const user = await User.create(userObject);

    if (user) {
      res.status(201).json({ message: `New user ${username} created` });
    } else {
      res.status(400).json({ message: "Invalid user data received" });
    }
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};

// @desc Update a user
// @route PATCH /users
// @access Private
const updateUser = async (req, res) => {
  const { id, username, roles, active, password } = req.body;

  // Confirm data
  if (
    !id ||
    !username ||
    !Array.isArray(roles) ||
    !roles.length ||
    typeof active !== "boolean"
  ) {
    return res
      .status(400)
      .json({ message: "All fields except password are required" });
  }

  // Does the user exist to update?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Check for duplicate
  const duplicate = await User.findOne({ username })
    .collation({ locale: "en", strength: 2 })
    .lean()
    .exec();

  // Allow updates to the original user
  if (duplicate && duplicate?._id.toString() !== id) {
    return res.status(409).json({ message: "Duplicate username" });
  }

  user.username = username;
  user.roles = roles;
  user.active = active;

  if (password) {
    // Hash password
    user.password = await bcrypt.hash(password, 10); // salt rounds
  }

  const updatedUser = await user.save();

  res.json({ message: `${updatedUser.username} updated` });
};

// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteUser = async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: "User ID Required" });
  }

  // Does the user still have assigned notes?
  const note = await Note.findOne({ user: id }).lean().exec();
  if (note) {
    return res.status(400).json({ message: "User has assigned notes" });
  }

  // Does the user exist to delete?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const result = await user.deleteOne();

  const reply = `Username ${result.username} with ID ${result._id} deleted`;

  res.json(reply);
};

// @desc Get user profile
// @route GET /users/:username/profile
// @access Private
const getUserProfile = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username })
      .select("-password") // Exclude password
      .populate("followers", "username")
      .populate("following", "username")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notes = await Note.find({ user: user._id }).lean();

    const profile = {
      ...user,
      notes: notes.map((note) => note._id),
    };

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Follow a user
// @route POST /users/:username/following
// @access Private
const followUser = async (req, res) => {
  const { username } = req.params;
  const current_username = req.user;
  const currentUser = await User.findOne({ username: current_username });

  try {
    const userToFollow = await User.findOne({ username: username });
    if (!userToFollow) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentUser === userToFollow) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    if (currentUser.following.includes(userToFollow.username)) {
      return res
        .status(400)
        .json({ message: "You are already following this user" });
    }

    currentUser.following.push(userToFollow.username);
    await currentUser.save();
    userToFollow.followers.push(current_username);
    await userToFollow.save();

    res.json({ message: `You are now following ${username}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Unfollow a user
// @route POST /users/:username/unfollowing
// @access Private
const unfollowUser = async (req, res) => {
  const { username } = req.params;
  const current_username = req.user;
  const currentUser = await User.findOne({ username: current_username });

  try {
    const userToUnfollow = await User.findOne({ username: username });
    if (!userToUnfollow) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentUser === userToUnfollow) {
      return res.status(400).json({ message: "You cannot unfollow yourself" });
    }

    if (!currentUser.following.includes(userToUnfollow.username)) {
      return res
        .status(400)
        .json({ message: "You are not following this user" });
    }

    currentUser.following = currentUser.following.filter(
      (followedUser) => followedUser !== userToUnfollow.username
    );
    await currentUser.save();

    userToUnfollow.followers = userToUnfollow.followers.filter(
      (follwerUser) => follwerUser !== current_username
    );
    await userToUnfollow.save();

    res.json({ message: `You have unfollowed ${username}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get user data by username
// @route GET /users/username/:username
// @access Private
const getUserDataByUsername = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username })
      .select("-password") // Exclude password
      .lean(); // Convert to plain JavaScript object

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  createNewUser,
  updateUser,
  deleteUser,
  getUserProfile,
  followUser,
  unfollowUser,
  getUserDataByUsername, // Keep this line
};
