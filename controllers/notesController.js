const Note = require("../models/Note");
const User = require("../models/User");

// @desc Get all notes
// @route GET /notes
// @access Private
const getAllNotes = async (req, res) => {
  try {
    // Get all notes from MongoDB
    const notes = await Note.find().lean();

    // If no notes
    if (!notes?.length) {
      return res.status(400).json({ message: "No notes found" });
    }

    // Add username to each note before sending the response
    const notesWithUser = await Promise.all(
      notes.map(async (note) => {
        try {
          const user = await User.findById(note.user).lean().exec();
          if (user) {
            return { ...note, username: user.username };
          } else {
            return { ...note, username: "Unknown User" }; // Handle case where user does not exist
          }
        } catch (error) {
          return { ...note, username: "Error retrieving user" }; // Handle errors in fetching user
        }
      })
    );

    res.json(notesWithUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get paginated notes
// @route GET /notes
// @access Private
const getPaginatedNotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number
    const limit = parseInt(req.query.limit) || 10; // Number of notes per page
    const skip = (page - 1) * limit; // Calculate how many documents to skip

    // Get total count of notes
    const totalNotes = await Note.countDocuments();

    // Get paginated notes from MongoDB
    const notes = await Note.find()
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit)
      .lean();

    // If no notes
    if (!notes?.length) {
      return res.status(400).json({ message: "No notes found" });
    }

    // Add username to each note before sending the response
    const notesWithUser = await Promise.all(
      notes.map(async (note) => {
        try {
          const user = await User.findById(note.user).lean().exec();
          if (user) {
            return { ...note, username: user.username };
          } else {
            return { ...note, username: "Unknown User" }; // Handle case where user does not exist
          }
        } catch (error) {
          return { ...note, username: "Error retrieving user" }; // Handle errors in fetching user
        }
      })
    );

    res.json({
      notes: notesWithUser,
      currentPage: page,
      totalPages: Math.ceil(totalNotes / limit),
      totalNotes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Create new note
// @route POST /notes
// @access Private
const createNewNote = async (req, res) => {
  const { user, title, text } = req.body;

  // Confirm data
  if (!user || !title || !text) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check for duplicate title
  const duplicate = await Note.findOne({ title })
    .collation({ locale: "en", strength: 2 })
    .lean()
    .exec();

  if (duplicate) {
    return res.status(409).json({ message: "Duplicate note title" });
  }

  // Create and store the new user
  const note = await Note.create({ user, title, text });

  if (note) {
    // Created
    return res.status(201).json({ message: "New note created" });
  } else {
    return res.status(400).json({ message: "Invalid note data received" });
  }
};

// @desc Update a note
// @route PATCH /notes
// @access Private
const updateNote = async (req, res) => {
  const { id, user, title, text, completed } = req.body;

  // Confirm data
  if (!id || !user || !title || !text || typeof completed !== "boolean") {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Confirm note exists to update
  const note = await Note.findById(id).exec();

  if (!note) {
    return res.status(400).json({ message: "Note not found" });
  }

  // Check for duplicate title
  const duplicate = await Note.findOne({ title })
    .collation({ locale: "en", strength: 2 })
    .lean()
    .exec();

  // Allow renaming of the original note
  if (duplicate && duplicate?._id.toString() !== id) {
    return res.status(409).json({ message: "Duplicate note title" });
  }

  note.user = user;
  note.title = title;
  note.text = text;
  note.completed = completed;

  const updatedNote = await note.save();

  res.json(`'${updatedNote.title}' updated`);
};

// @desc Delete a note
// @route DELETE /notes
// @access Private
const deleteNote = async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: "Note ID required" });
  }

  // Confirm note exists to delete
  const note = await Note.findById(id).exec();

  if (!note) {
    return res.status(400).json({ message: "Note not found" });
  }

  const result = await note.deleteOne();

  const reply = `Note '${result.title}' with ID ${result._id} deleted`;

  res.json(reply);
};

// @desc Like a note
// @route PATCH /notes/:id/like
// @access Private
const likeNote = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const note = await Note.findById(id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (note.likedBy.includes(userId)) {
      // User already liked, so we undo the like
      note.likedBy = note.likedBy.filter((user) => user.toString() !== userId);
      note.likes--;
    } else if (note.dislikedBy.includes(userId)) {
      // User is in the dislike list, so we remove from dislike and add to like
      note.dislikedBy = note.dislikedBy.filter(
        (user) => user.toString() !== userId
      );
      note.likedBy.push(userId);
      note.likes += 2;
    } else {
      // User is not in either list, so we add to like
      note.likedBy.push(userId);
      note.likes++;
    }

    await note.save();

    res.json({
      message: "Note like status updated successfully",
      userId: userId,
      likes: note.likes,
      dislikes: note.dislikedBy.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Dislike a note
// @route PATCH /notes/:id/dislike
// @access Private
const dislikeNote = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const note = await Note.findById(id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (note.dislikedBy.includes(userId)) {
      // User already disliked, so we undo the dislike
      note.dislikedBy = note.dislikedBy.filter(
        (user) => user.toString() !== userId
      );
      note.likes++;
    } else if (note.likedBy.includes(userId)) {
      // User is in the like list, so we remove from like and add to dislike
      note.likedBy = note.likedBy.filter((user) => user.toString() !== userId);
      note.dislikedBy.push(userId);
      note.likes -= 2;
    } else {
      // User is not in either list, so we add to dislike
      note.dislikedBy.push(userId);
      note.likes--;
    }

    await note.save();

    res.json({
      message: "Note dislike status updated successfully",
      userId: userId,
      likes: note.likes,
      dislikes: note.dislikedBy.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  getAllNotes,
  getPaginatedNotes,
  createNewNote,
  updateNote,
  deleteNote,
  likeNote,
  dislikeNote,
};
