const express = require("express");
const router = express.Router();
const notesController = require("../controllers/notesController");
const verifyJWT = require("../middleware/verifyJWT");

// Routes that don't require authentication
// router.route("/").get(notesController.getAllNotes);
router.route("/").get(notesController.getPaginatedNotes);
router.route("/trending").get(notesController.getTrendingNotes);

router.route("/:id/like").patch(notesController.likeNote);

router.route("/:id/dislike").patch(notesController.dislikeNote);

router.route("/:id").get(notesController.getNoteById);

router.route("/:id/views").patch(notesController.incrementViews);

// Add this new route before the authenticated routes
router.route("/user/:username").get(notesController.getNotesByUsername);

// Add the new route for getFollowerNotes

// Routes that require authentication
router.use(verifyJWT);
router.route("/following/:username").get(notesController.getFollowerNotes);

router
  .route("/")
  .post(notesController.createNewNote)
  .patch(notesController.updateNote);

router.route("/:id").delete(notesController.deleteNote);

module.exports = router;
