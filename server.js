require("dotenv").config();
require("express-async-errors");
const express = require("express");
const app = express();
const path = require("path");
const { logger, logEvents } = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const connectDB = require("./config/dbConn");
const mongoose = require("mongoose");
const PORT = process.env.PORT || 3500;
const pingRoutes = require("./routes/pingRoutes");

console.log(process.env.NODE_ENV);

if (
  !process.env.ACCESS_TOKEN_SECRET ||
  !process.env.REFRESH_TOKEN_SECRET ||
  !process.env.TEMP_TOKEN_SECRET
) {
  console.error(
    "One or more required environment variables are not set. Please check your .env file."
  );
  process.exit(1);
}

connectDB();

app.use(logger);

app.use(cors(corsOptions));

app.use(express.json());

app.use(cookieParser());

app.use("/", express.static(path.join(__dirname, "public")));

app.use("/", require("./routes/s3Upload"));
app.use("/", require("./routes/s3Delete"));
// app.use("/", require("./routes/imageRoute"));
app.use("/", require("./routes/root"));
app.use("/", require("./routes/commentRoutes"));
app.use("/auth", require("./routes/authRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/notes", require("./routes/noteRoutes"));
// app.use("/ping", pingRoutes);

app.all("*", (req, res) => {
  res.status(404);
  if (req.accepts("html")) {
    res.sendFile(path.join(__dirname, "views", "404.html"));
  } else if (req.accepts("json")) {
    res.json({ message: "404 Not Found" });
  } else {
    res.type("txt").send("404 Not Found");
  }
});

app.use(errorHandler);

mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

mongoose.connection.on("error", (err) => {
  console.log(err);
  logEvents(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    "mongoErrLog.log"
  );
});
