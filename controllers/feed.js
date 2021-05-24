const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const Post = require("../models/post");

exports.getPosts = (req, res, next) => {
  // ?: The json will be rendered on the screen in the react app
  // ?: res.json will convert a js object to json
  Post.find()
    .then((posts) => {
      res.status(200).json({
        message: "Posts fetched from DB successfully",
        posts,
      });
    })
    .catch((err) => {
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    });
};

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);

  // ?: If there is an error, send over an error
  if (!errors.isEmpty()) {
    const error = new Error("Validation on server failed");
    error.statusCode = 422;
    throw error; // ?: When the error is thrown in sync code, it will go to the nearest try catch, which is the error handling middleware in app.js
    // return res.status(422).json({
    //   message: "Validation on server failed!", // errors.array()[0].msg
    //   errors: errors.array(),
    // });
  }

  if (!req.file) {
    // ?: Can happen if the user did not provide a file or file type is not jpg/jpeg/png
    const error = new Error("No image provided");
    error.statusCode = 422;
    throw error;
  }

  const imageUrl = req.file.path.replace("\\", "/");

  const post = new Post({
    title: req.body.title,
    imageUrl,
    content: req.body.content,
    creator: { name: "Roy" },
  });

  post
    .save()
    .then((result) => {
      res.status(201).json({
        message: "Successfully created post",
        post: result,
      });
    })
    .catch((err) => {
      if (!err.statusCode) err.statusCode = 500; // ?: Sets the default err status code to 500
      next(err); // ?: When error occurs in async code, need to use next(err) to send the code to the error handling middleware
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post");
        err.statusCode = 404;
        throw error; // ?: throw err will end up in catch block below, and next(err) will be called on it
      }

      res.status(200).json({ message: "Post fetched", post });
    })
    .catch((err) => {
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    });
};

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req);

  // ?: If there is an error, send over an error
  if (!errors.isEmpty()) {
    const error = new Error("Validation on server failed");
    error.statusCode = 422;
    throw error; // ?: When the error is thrown in sync code, it will go to the nearest try catch, which is the error handling middleware in app.js
    // return res.status(422).json({
    //   message: "Validation on server failed!", // errors.array()[0].msg
    //   errors: errors.array(),
    // });
  }

  const postId = req.params.postId;
  // ?: If the user did not upload a new image, use the old image address.
  // ?: If a file was uploaded, use the new file

  // if (!imageUrl) {
  //   const error = new Error("No file picked");
  //   error.statusCode = 422;
  //   throw error;
  // }

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post");
        error.statusCode = 404;
        throw error;
      }

      // ?: There is an error on the front end as image is sometimes === undefined. This helps to replace the image if it is undefined
      let imageUrl = req.body.image;
      if (req.file) {
        imageUrl = req.file.path.replace("\\", "/");
      } else {
        imageUrl = post.imageUrl;
      }

      console.log(`Image Url 2: ${imageUrl}`);

      // ?: If the new image is not the same as the old image, delete the old image
      if (post.imageUrl !== imageUrl) {
        clearImage(post.imageUrl);
      }

      post.title = req.body.title;
      post.content = req.body.content;
      post.imageUrl = imageUrl;

      return post.save();
    })
    .then((result) => {
      res.status(200).json({
        message: "Post updated!",
        post: result,
      });
    })
    .catch((err) => {
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    });
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(`Error: ${err}`));
};

// ?: In order to post from browser/app, body needs to be in JSON and header needs to be set, otherwise, req.body will be undefined
// fetch("http://localhost:8080/feed/post", {
//   method: "POST",
//   body: JSON.stringify({ // ?: Converts js object to JSON
//     title: "A codepen post",
//     body: "created by codepen",
//   }),
//   headers: {
//     "Content-Type": "application/json", // ?: Sets content-type header
//   },
// });
