// routes/commentRoutes.js
const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Note = require("../models/Note");
const verifyJWT = require("../middleware/verifyJWT");

// Get all comments for a note
router.get("/notes/:noteId/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ noteId: req.params.noteId });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a new comment
router.post("/notes/:noteId/comments", verifyJWT, async (req, res) => {
  const comment = new Comment({
    text: req.body.text,
    username: req.user, // req.user now contains the username
    noteId: req.params.noteId,
  });

  try {
    const newComment = await comment.save();
    res.status(201).json(newComment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a comment
router.patch("/notes/:noteId/comments/:id", verifyJWT, async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      noteId: req.params.noteId,
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (comment.username !== req.user) {
      return res
        .status(403)
        .json({ message: "You can only edit your own comments" });
    }

    if (req.body.text) {
      comment.text = req.body.text;
    }

    const updatedComment = await comment.save();
    res.json(updatedComment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a comment
router.delete("/notes/:noteId/comments/:id", verifyJWT, async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      noteId: req.params.noteId,
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (comment.username !== req.user) {
      return res
        .status(403)
        .json({ message: "You can only delete your own comments" });
    }

    await comment.deleteOne();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
