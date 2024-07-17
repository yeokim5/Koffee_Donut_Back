const express = require("express");
const router = express.Router();
const notesController = require("../controllers/notesController");
const verifyJWT = require("../middleware/verifyJWT");

// Routes that don't require authentication
router.route("/").get(notesController.getAllNotes);

router.route("/:id/like").patch(notesController.likeNote);

router.route("/:id/dislike").patch(notesController.dislikeNote);

// Routes that require authentication
router.use(verifyJWT);

router
  .route("/")
  .post(notesController.createNewNote)
  .patch(notesController.updateNote)
  .delete(notesController.deleteNote);

module.exports = router;
