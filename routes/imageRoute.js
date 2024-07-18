const path = require("path");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const ImageModel = require("../models/Image");

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
});

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  ImageModel.create({ image: req.file.filename })
    .then((result) =>
      res.json({ ...result.toObject(), message: "File uploaded successfully." })
    )
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ error: "An error occurred while uploading the file." });
    });
});

router.get("/getImage", (req, res) => {
  ImageModel.find()
    .then((users) => res.json(users))
    .catch((err) => console.log(err));
});

module.exports = router;
