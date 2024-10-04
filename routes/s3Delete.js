const express = require("express");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const router = express.Router();

const BUCKET_NAME = process.env.BUCKET_NAME;
const REGION = process.env.REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

// S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

router.post("/notes/delete-image", async (req, res) => {
  console.log("Received delete request");

  const { imageUrl } = req.body;

  if (!imageUrl) {
    console.error("No image URL provided");
    return res.status(400).json({ success: 0, error: "No image URL provided" });
  }

  try {
    const key = imageUrl.split("/").pop();
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3.send(command);

    console.log("Image deleted successfully");
    res.json({
      success: 1,
      message: "Image deleted successfully",
    });
  } catch (err) {
    console.error("Error in S3 delete:", err);
    res.status(500).json({ success: 0, error: `Delete error: ${err.message}` });
  }
});

module.exports = router;
