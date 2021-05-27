require("dotenv").config();
const path = require("path");

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { graphqlHTTP } = require("express-graphql");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");
const { clearImage } = require("./util/file");

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

// app.use(bodyParser.urlencoded()); // ?: This is for parsing FORM data from webpages
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

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ?: Will run on every request that reaches the graphql endpoint (because it is above it)
app.use(auth); // !: May set isAuth to false, which can be handled in /graphql below

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error("Not authenticated");
    error.code = 401;
    throw error;
  }

  if (!req.file) {
    return res.status(200).json({ message: "No file provided" }); // ?: Don't return an error as updating posts does not require a new file
    // !: No filePath is sent
  }

  // ?: If user uploaded a file during updating, delete the old file
  // ?: req.body only has oldPath when updating, not deleting
  if (req.body.oldPath) {
    console.log(`Old Path:`);
    console.log(req.body.oldPath);
    // ?: An old image path was passed with the request
    clearImage(req.body.oldPath); // ?: Delete the old image
  }

  return res.status(201).json({
    message: "File storage",
    filePath: req.file.path.replace("\\", "/"),
  });
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true, // ?: Creates a GUI that you can use to play around with the graphql API
    formatError(err) {
      console.error(err);
      if (!err.originalError) {
        // ?: original errors are thrown (either by you or a package)
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An error occurred";
      const code = err.originalError.code || 500;
      // ?: Data will end up in the errors field in the response object
      return { message, status: code, data };
    },
  })
);

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
    app.listen(8080);
  })
  .catch((err) => {
    console.error(err);
  });
