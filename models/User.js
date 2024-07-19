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
    validate: {
      validator: function (v) {
        if (this.authMethod === "google") {
          return v != null; // If authMethod is google, email must be set
        }
        return true; // If authMethod is not google, email can be null
      },
      message: "Email is required for google authentication",
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

// Middleware to ensure email is unset for local authMethod
userSchema.pre("save", function (next) {
  if (this.authMethod !== "google") {
    this.email = undefined;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
