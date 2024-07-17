const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: function () {
      return this.authMethod === "google";
    },
    unique: function () {
      return this.email != null;
    },
  },
  name: {
    type: String,
    required: function () {
      return this.authMethod === "google";
    },
  },
  roles: {
    type: [String],
    default: ["Employee"],
  },
  active: {
    type: Boolean,
    default: true,
  },
  authMethod: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },
  following: [
    {
      type: String,
    },
  ],
  followers: [
    {
      type: String,
    },
  ],
});

userSchema.pre("save", function (next) {
  if (this.authMethod === "local" && !this.email) {
    this.email = undefined;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
