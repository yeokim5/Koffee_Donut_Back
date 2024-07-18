const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
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

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: BUCKET_NAME,
    // Removed the acl option to avoid AccessControlListNotSupported error
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
}).single("file");

router.post("/upload", (req, res) => {
  console.log("Received upload request");

  upload(req, res, function (err) {
    if (err) {
      console.error("Error in S3 upload:", err);
      return res
        .status(500)
        .json({ success: 0, error: `Upload error: ${err.message}` });
    }

    console.log("Processed file:", req.file);

    if (!req.file) {
      console.error("No file received");
      return res.status(400).json({ success: 0, error: "No file uploaded" });
    }

    console.log("File uploaded successfully");
    res.json({
      success: 1,
      file: {
        url: req.file.location,
      },
    });
  });
});

module.exports = router;
