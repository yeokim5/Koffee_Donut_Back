// Backend: deleteImages.js
const express = require("express");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const router = express.Router();

const BUCKET_NAME = process.env.BUCKET_NAME;
const REGION = process.env.REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

router.delete("/delete-images", async (req, res) => {
  const { fileNames } = req.body;

  if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
    return res
      .status(400)
      .json({ error: "Invalid or missing fileNames array" });
  }

  try {
    const deletePromises = fileNames.map((fileName) => {
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: fileName,
      };
      const command = new DeleteObjectCommand(deleteParams);
      return s3.send(command);
    });

    await Promise.all(deletePromises);
    res.json({ message: "Images deleted successfully" });
  } catch (error) {
    console.error("Error deleting images:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
