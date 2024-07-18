const path = require("path");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs").promises;
const ImageModel = require("../models/Image");
const Note = require("../models/Note"); // Assuming you have a Note model

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
}).single("image");

router.post("/upload", (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res.status(500).json({ success: 0, error: err.message });
    } else if (err) {
      console.error("Unknown error:", err);
      return res
        .status(500)
        .json({ success: 0, error: "An unknown error occurred." });
    }

    if (!req.file) {
      return res.status(400).json({ success: 0, error: "No file uploaded." });
    }

    ImageModel.create({ image: req.file.filename })
      .then(() => {
        res.json({
          success: 1,
          file: {
            url: `http://localhost:3500/img/${req.file.filename}`,
          },
        });
      })
      .catch((err) => {
        console.error("Database error:", err);
        res.status(500).json({
          success: 0,
          error: "An error occurred while saving the file information.",
        });
      });
  });
});

router.post("/getImage", (req, res) => {
  const { url } = req.body;

  // Here you would typically download the image from the provided URL
  // and save it to your server. For this example, we'll just return the URL.
  res.json({
    success: 1,
    file: {
      url: url,
    },
  });
});

router.delete("/deleteImages", async (req, res) => {
  try {
    const { fileNames } = req.body;

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return res
        .status(400)
        .json({ success: 0, error: "Invalid or empty fileNames array" });
    }

    const deletedFiles = [];
    const failedFiles = [];

    // Delete images from the file system
    for (const filename of fileNames) {
      const filePath = path.join(__dirname, "..", "public", "img", filename);
      try {
        await fs.unlink(filePath);
        deletedFiles.push(filename);
        console.log(`Deleted file: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
        failedFiles.push(filename);
      }
    }

    // Delete image records from the database
    const deleteResult = await ImageModel.deleteMany({
      image: { $in: deletedFiles },
    });
    console.log(
      `Deleted ${deleteResult.deletedCount} image records from database`
    );

    res.json({
      success: 1,
      message: "Image deletion process completed",
      deletedFiles,
      failedFiles,
    });
  } catch (err) {
    console.error("Error deleting images:", err);
    res.status(500).json({ success: 0, error: "Failed to delete images" });
  }
});

module.exports = router;
