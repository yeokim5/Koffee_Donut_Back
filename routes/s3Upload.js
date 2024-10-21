const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
require("dotenv").config();

const router = express.Router();

const BUCKET_NAME = process.env.BUCKET_NAME;
const REGION = process.env.REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

// S3 client
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// Use memory storage to get the file buffer before uploading to S3
const upload = multer({
  storage: multer.memoryStorage(),
}).single("file");

router.post("/upload", (req, res) => {
  console.log("Received upload request");

  upload(req, res, async function (err) {
    if (err) {
      console.error("Error in upload:", err);
      return res
        .status(500)
        .json({ success: 0, error: `Upload error: ${err.message}` });
    }

    if (!req.file) {
      console.error("No file received");
      return res.status(400).json({ success: 0, error: "No file uploaded" });
    }

    // Process the uploaded image with sharp
    try {
      const buffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 800, height: 600, fit: "inside" })
        .webp({ quality: 80 })
        .toBuffer();

      // Generate a unique filename
      const fileName = `${Date.now()}-${
        req.file.originalname.split(".")[0]
      }.webp`;

      // Upload the processed image to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: "image/webp",
        })
      );

      console.log("File uploaded successfully");
      res.json({
        success: 1,
        file: {
          url: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`,
        },
      });
    } catch (processingError) {
      console.error("Error processing file:", processingError);
      return res.status(500).json({
        success: 0,
        error: `Processing error: ${processingError.message}`,
      });
    }
  });
});

module.exports = router;
