const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const Post = require("../models/post");
const User = require("../models/user");
const io = require("../socket");
const user = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1; // ?: default value is 1
  const perPage = 2; // TODO: Coordinate with front end

  // ?: The json will be rendered on the screen in the react app
  // ?: res.json will convert a js object to json

  try {
    const totalItems = await Post.find().countDocuments(); // ?: Count num of posts
    const posts = await Post.find() // ?: Only get the posts for this page
      .populate("creator")
      .sort({ createdAt: -1 }) // ?: Sorts such that the latest post comes first
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Posts fetched from DB successfully",
      totalItems, // ?: Tell the front end how many items in total
      posts,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    console.log("User Id" + req.userId);
    const user = await User.findById(req.userId);

    if (!user) {
      console.log("user could not be found");
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const status = user.status;

    res.status(200).json(JSON.stringify({ status }));
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error(errors.array()[0].msg);
      error.statusCode = 422;
      throw error; // ?: When the error is thrown in sync code, it will go to the nearest try catch, which is the error handling middleware in app.js
    }

    const user = await User.findById(req.userId);

    if (!user) {
      console.log("user could not be found");
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.status = req.body.newStatus;
    const updatedUser = await user.save();

    res.status(200).json(JSON.stringify({ user: updatedUser }));
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
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
  let creator;
  // console.log(`Creator: ${req.userId}`);

  const post = new Post({
    title: req.body.title,
    imageUrl,
    content: req.body.content,
    creator: req.userId, // ?: It is a string, but mongoose will convert it into a ObjectId
  });

  post
    .save()
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then((result) => {
      // ?: emit sends to all users. broadcast sends to all other users
      io.getIO().emit("posts", {
        // ?: Front end will listen to 'posts'
        action: "create", // ?: Can send any js object, which front end will receive when they listen to posts
        post: {
          ...post._doc, // ?: Get the post document spread out
          creator: {
            _id: req.userId,
            name: creator.name,
          },
        },
      });

      res.status(201).json({
        message: "Successfully created post",
        post,
        creator: { _id: creator._id, name: creator.name },
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
  }

  const postId = req.params.postId;

  Post.findById(postId)
    .populate("creator") // ?: Uses the reference that 'creator' has to get user data
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post");
        error.statusCode = 404;
        throw error;
      }

      if (post.creator._id.toString() !== req.userId) {
        const error = new Error("Not authorised");
        error.statusCode = 403;
        throw error;
      }

      // ?: There is an error on the front end as image is sometimes === undefined. This helps to replace the image if it is undefined
      // ?: If the user did not upload a new image, use the old image address.
      // ?: If a file was uploaded, use the new file
      let imageUrl = req.body.image;
      if (req.file) {
        imageUrl = req.file.path.replace("\\", "/");
      } else {
        imageUrl = post.imageUrl;
      }

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
      io.getIO().emit("posts", {
        action: "update",
        post: result,
      });

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

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post");
        error.statusCode = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error("Not authorized");
        error.statusCode = 403;
        throw error;
      }

      clearImage(post.imageUrl); // ?: Delete the image file on the server
      return Post.findByIdAndRemove(postId);
    })
    .then((result) => User.findById(req.userId))
    .then((user) => {
      user.posts.pull(postId);
      return user.save();
    })
    .then((result) => {
      io.getIO().emit("posts", {
        action: "delete",
        post: postId,
      });
      console.log(result);
      res.status(200).json({ message: "Deleted post." });
    })
    .catch((err) => {
      console.error(err);
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    });
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(`Error: ${err}`)); // ?: Clears files from the server
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
