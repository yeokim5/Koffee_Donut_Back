const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    sparse: true, // This allows null values and maintains uniqueness for non-null values
  },
  password: {
    type: String,
    required: function () {
      return this.authMethod === "local";
    },
  },
  email: {
    type: String,
    // required: true,
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
  isTemporary: {
    type: Boolean,
    default: false,
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
