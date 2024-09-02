const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const verifyJWT = require("../middleware/verifyJWT");

router.route("/all").get(usersController.getAllUsers);
router.route("/").post(usersController.createNewUser);
router.route("/:username").get(usersController.getUserDataByUsername);

router.use(verifyJWT);
router.route("/:username/following").post(usersController.followUser);
router.route("/:username/unfollowing").post(usersController.unfollowUser);

router
  .route("/")
  .patch(usersController.updateUser)
  .delete(usersController.deleteUser);

module.exports = router;
