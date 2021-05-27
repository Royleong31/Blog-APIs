require("dotenv").config();

const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const Post = require("../models/post");
const User = require("../models/user");
const { clearImage } = require("../util/file");

module.exports = {
  // ?: Needs to return type User
  createUser: async function ({ userInput }, req) {
    const errors = [];

    // !: If using .then(), need to return the promise otherwise graphql will not wait. But since this is an async func, a promise is returned by default.
    const existingUser = await User.findOne({ email: userInput.email });

    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Email is invalid" });
    }

    // ?: If password is empty or not long enough
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password is too short" });
    }

    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.data = errors;
      error.code = 422; // ?: does not need to follow http error codes
      throw error;
    }

    if (existingUser) {
      const error = new Error("User already exists");
      throw error;
    }

    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      password: hashedPw,
      name: userInput.name,
    });

    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() }; // ?: Returns the new user doc, but the id is returned as a string instead of a ObjectId().
    // !: RMB to put ._doc: This removes the metadata
  },

  // ?: first arg of the function is an args object that contains the parameters listed in the query (use destructuring to get them out)
  login: async function ({ email, password }) {
    const user = await User.findOne({ email }); // ?: Find the user whose email matches the input

    if (!user) { // ?: Errors will be caught in app.js
      const error = new Error("User not found");
      error.code = 401;
      throw error;
    }

    // TODO: Add validation

    const isEqual = await bcrypt.compare(password, user.password);

    if (!isEqual) {
      const error = new Error("Password is incorrect");
      error.code = 422;
      throw error;
    }

    // ?: Encrypts userId and email into jwt
    // ?: Can use this to check auth status
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      process.env.JWTSECRET,
      { expiresIn: "1h" }
    );

    return { token, userId: user._id.toString() };
  },

  createPost: async function (
    { postInput: { title, imageUrl, content } },
    req
  ) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const errors = [];

    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is invalid" });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({ message: "content is invalid" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user");
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title,
      imageUrl,
      content,
      creator: user, // ?: only stores user._id
    });

    // ?: Don't need to populate as it was already in the post above
    const createdPost = await post.save(); // ?: creator consists of the user data

    console.log('Created Post');
    console.log(createdPost);
    
    user.posts.push(createdPost); // ?: Add post to user's posts array (only stores the post._id)

    await user.save();

    return {
      ...createdPost._doc, // !: RMB to put the ._doc to get the document
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  updatePost: async function (
    { id, postInput: { title, imageUrl, content } },
    req
  ) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }

    // ?: Ensure that the user trying to update the post is the currently logged in user
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized");
      error.code = 403;
      throw error;
    }

    const errors = [];
    // ?: Validation Checks
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is invalid" });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({ message: "content is invalid" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = title;
    post.content = content;
    // ?: Undefined imageUrl means that the user did not upload a new image
    if (imageUrl !== "undefined") post.imageUrl = imageUrl;

    const updatedPost = await post.save();

    return {
      ...updatedPost._doc, // !: RMB to put the ._doc to get the document
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    page = page ? page : 1; // ?: Set default page no. to 1
    const perPage = 2;

    const totalPosts = await Post.find().countDocuments(); // ?: Total no. of posts

    // ?: Pagination
    const posts = await Post.find()
      .sort({ createdAt: -1 }) //?: Newest posts first
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("creator"); // ?: uses the creator ref to get the data of the user

    return {
      posts: posts.map((p) => {
        return {
          ...p._doc, // ?: This removes the unnecessary metadata
          id: p._id.toString(), // ?: Converts from ObjectId to string
          createdAt: p.createdAt.toISOString(), // ?: converts from Date Object to ISOSTRING
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts,
    };
  },

  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    // ?: find a post then populate it
    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }

    // ?: Ensure that the user trying to update the post is the currently logged in user
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized");
      error.code = 403;
      throw error;
    }

    try {
      clearImage(post.imageUrl);
      await Post.findByIdAndRemove(id);
      const user = await User.findById(req.userId);
      user.posts.pull(id);
      await user.save();
      return true;
    } catch (error) {
      console.log(`Error in deletePost`);
      console.error(error);
      return false;
    }
  },

  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("No user found");
      error.code = 404;
      throw error;
    }

    return { ...user._doc, _id: user._id.toString() };
  },

  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    user.status = status;

    await user.save();

    return { ...user._doc, _id: user._id.toString() };
  },
};
