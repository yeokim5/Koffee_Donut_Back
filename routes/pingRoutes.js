const express = require("express");
const router = express.Router();
const pingController = require("../controllers/pingController");

router.route("/").get(pingController.ping);

module.exports = router;
