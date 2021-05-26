require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images"); // ?: File storage destination
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + "=" + file.originalname); // ?: Sets file name to be stored in server
  },
});

const fileFilter = (req, file, cb) => {
  // ?: If the file type is jpg or png, save it. Otherwise, don't
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true); // ?: true means that the file is to be saved
  } else {
    cb(null, false); // ?: false means that the file is not to be saved
  }
};

// app.use(bodyParser.urlencoded()); // ?: This is for parsing FORM data
app.use(bodyParser.json()); // ?: This is for parsing json from APIs
app.use(multer({ storage: fileStorage, fileFilter }).single("image")); // ?: single('image') comes in form from front end
app.use("/images", express.static(path.join(__dirname, "images"))); // ?: images folder will be served statically for requests going to '/images'

// ?: This will add these headers to all requests
// ?: This enables CORS, allowing requests from non native domain to be allowed in
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // !: need to allow this (second argument can be used to filter from certain domains)
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // !: Need to set header otherwise CORS error
  next();
});

// ?: Filters routes based on the params. Is done from top to bottom, so more specific routes on top.
app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

// ?: Error Handling middleware (has 4 arguments). Uncaught errors come here
app.use((err, req, res, next) => {
  console.log(err);
  const statusCode = err.statusCode || 500; // ?: Sets default to 500
  const message = err.message; // ?: holds the string you pass into the new Error('') constructor
  const data = err.data; // ?: In case the error has a data property

  res.status(statusCode).json({ message, data });
});

mongoose
  .connect(process.env.MONGO_ADDRESS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    const server = app.listen(8080);

    // ?: This sets up the server with socket io
    const io = require("./socket").init(server);

    // ?: Listener for when a connection is established with client
    io.on("connection", (socket) => {
      console.log("Client connected");
    });
  })
  .catch((err) => {
    console.error(err);
  });
