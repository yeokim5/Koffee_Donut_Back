const Note = require("../models/Note");
const User = require("../models/User");

// Add at the top of the file
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const CACHE_TTL_TRENDING = 30 * 60 * 1000; // 30 minutes for trending

// Helper function to get cached data or fetch new data
const getCachedOrFresh = async (cacheKey, fetchFunction, ttl = CACHE_TTL) => {
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < ttl) {
      return { data, fromCache: true };
    }
    cache.delete(cacheKey);
  }

  const data = await fetchFunction();

  // Cache the response
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  return { data, fromCache: false };
};

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `notes_${page}_${limit}`;

    const fetchNotes = async () => {
      const skip = (page - 1) * limit;
      const totalNotes = await Note.countDocuments();

      const notes = await Note.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      if (!notes?.length) {
        throw { status: 404, message: "No notes found" };
      }

      const notesWithUser = await Promise.all(
        notes.map(async (note) => {
          const user = await User.findById(note.user).lean().exec();
          return { ...note, username: user ? user.username : "Unknown User" };
        })
      );

      return {
        notes: notesWithUser,
        currentPage: page,
        totalPages: Math.ceil(totalNotes / limit),
        totalNotes,
      };
    };

    const { data, fromCache } = await getCachedOrFresh(cacheKey, fetchNotes);
    res.setHeader("X-From-Cache", fromCache);
    res.json(data);
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

// @desc Create new note
// @route POST /notes
// @access Private
const createNewNote = async (req, res) => {
  const { user, title, text, imageURL } = req.body;

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
  const note = await Note.create({ user, title, text, imageURL });

  if (note) {
    // Clear all notes-related caches to ensure fresh data is fetched
    for (const key of cache.keys()) {
      if (key.startsWith("notes_") || key === "trending_notes") {
        cache.delete(key);
      }
    }

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
  const { id, user, title, text, completed, imageURL } = req.body;

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
  note.imageURL = imageURL; // Add this line to update the imageURL

  const updatedNote = await note.save();

  // Clear cache after updating a note
  for (const key of cache.keys()) {
    if (key.startsWith("notes_") || key === "trending_notes") {
      cache.delete(key);
    }
  }

  res.json(`'${updatedNote.title}' updated`);
};

// @desc Delete a note
// @route DELETE /notes
// @access Private
const deleteNote = async (req, res) => {
  const { id } = req.params; // Change from req.body to req.params

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

  // Clear cache after deleting a note
  for (const key of cache.keys()) {
    if (key.startsWith("notes_") || key === "trending_notes") {
      cache.delete(key);
    }
  }

  const reply = `Note '${result.title}' with ID ${result._id} deleted`;

  res.json(reply);
};

// @desc Like a note
// @route PATCH /notes/:id/like
// @access Private
const likeNote = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

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

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

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

// @desc Get a single note by ID
// @route GET /notes/:id
// @access Private
const getNoteById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).lean().exec();

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    const user = await User.findById(note.user).lean().exec();
    const noteWithUser = {
      ...note,
      username: user ? user.username : "Unknown User",
    };

    res.json(noteWithUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get notes by username
// @route GET /notes/user/:username
// @access Public
const getNotesByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notes = await Note.find({ user: user._id })
      .sort({ createdAt: -1 })
      .lean();

    // if (!notes?.length) {
    //   return res.status(404).json({ message: "No notes found for this user" });
    // }

    const notesWithUsername = notes.map((note) => ({ ...note, username }));

    res.json(notesWithUsername);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get trending notes
// @route GET /notes/trending
// @access Public
const getTrendingNotes = async (req, res) => {
  try {
    const cacheKey = "trending_notes";

    const fetchTrendingNotes = async () => {
      // Get notes from last 7 days instead of 24 hours, sorted by engagement
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const trendingNotes = await Note.find({
        createdAt: { $gte: sevenDaysAgo },
      })
        .sort({ likes: -1, views: -1, createdAt: -1 }) // Sort by likes, views, then date
        .limit(20) // Limit to top 20 trending
        .lean();

      if (!trendingNotes.length) {
        return [];
      }

      const trendingNotesWithUser = await Promise.all(
        trendingNotes.map(async (note) => {
          const user = await User.findById(note.user).lean().exec();
          return { ...note, username: user ? user.username : "Unknown User" };
        })
      );

      return trendingNotesWithUser;
    };

    const { data } = await getCachedOrFresh(
      cacheKey,
      fetchTrendingNotes,
      CACHE_TTL_TRENDING
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get notes from users that the specified user is following
// @route GET /notes/following/:username
// @access Private
const getFollowerNotes = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const following = user.following;
    const followedUsers = await User.find({
      username: { $in: following },
    }).exec();
    const followedUserIds = followedUsers.map((user) => user._id);

    const notes = await Note.find({ user: { $in: followedUserIds } })
      .sort({ createdAt: -1 })
      .lean();

    const notesWithUsername = await Promise.all(
      notes.map(async (note) => {
        const noteUser = await User.findById(note.user).lean().exec();
        return {
          ...note,
          username: noteUser ? noteUser.username : "Unknown User",
        };
      })
    );

    res.json(notesWithUsername);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete an image
// @route POST /notes/delete-image
// @access Private
const deleteImage = async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ message: "Image URL is required" });
  }

  await deleteS3Object(imageUrl);

  res.json({ message: "Image deleted successfully" });
};

// @desc increment view
// @route PATCH /notes/:id/views
// @access Private
const incrementViews = async (req, res) => {
  const { id } = req.params;

  try {
    const note = await Note.findById(id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    note.views += 1;
    await note.save();

    res.json({ message: "View count updated successfully", views: note.views });
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
  getNoteById,
  getNotesByUsername,
  getTrendingNotes,
  getFollowerNotes,
  deleteImage,
  incrementViews,
};
