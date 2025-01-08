const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");
require("dotenv").config();

const router = express.Router();

const BUCKET_NAME = process.env.BUCKET_NAME;
const REGION = process.env.REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

app.use(cors({ origin: "https://www.koffeed.com" }));

// S3 client
const s3 = new AWS.S3({
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  region: REGION,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldname: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `${Date.now().toString()}-${file.originalname}`);
    },
  }),
}).single("file"); // Changed from 'image' to 'file'

router.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Error uploading to S3:", err);
      return res
        .status(500)
        .json({ success: 0, error: `Error uploading to S3: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ success: 0, error: "No file uploaded" });
    }

    res.json({
      success: 1,
      file: {
        url: req.file.location,
        key: req.file.key,
        bucket: req.file.bucket,
      },
    });
  });
});

module.exports = router;
