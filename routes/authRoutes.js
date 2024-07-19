const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const loginLimiter = require("../middleware/loginLimiter");
const verifyJWT = require("../middleware/verifyJWT");

router.route("/").post(loginLimiter, authController.login);
router.route("/logout").post(authController.logout);
router.route("/google").post(authController.googleLogin);
router.route("/set-username").post(authController.setUsername);
router.route("/refresh").get(authController.refresh);

module.exports = router;
