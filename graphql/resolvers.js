require("dotenv").config();

const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const Post = require("../models/post");
const User = require("../models/user");

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

  login: async function ({ email, password }) {
    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error("User not found");
      error.code = 401;
      throw error;
    }

    const isEqual = await bcrypt.compare(password, user.password);

    if (!isEqual) {
      const error = new Error("Password is incorrect");
      error.code = 422;
      throw error;
    }

    // ?: Encrypts userId and email into jwt
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

    const createdPost = await post.save();
    console.log("BEFORE PUSHING POSTS");

    user.posts.push(createdPost); // ?: Add post to user's posts array (only stores the post._id)
    console.log(`AFTER PUSHING POSTS`);

    await user.save();

    console.log(createdPost.title);
    console.log({ ...createdPost });

    return {
      ...createdPost._doc, // !: RMB to put the ._doc to get the document
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
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

    // TODO: Add pagination logic
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
};
