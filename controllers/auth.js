require("dotenv").config();

const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

exports.signup = (req, res, next) => {
  // ?: Immediately return an error if validation failed. Will get caught in error handling middleware
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed on signup");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  bcrypt
    .hash(req.body.password, 12)
    .then((hashedPw) => {
      const user = new User({
        email: req.body.email,
        password: hashedPw,
        name: req.body.name,
      });

      return user.save();
    })
    .then((result) => {
      res.status(201).json({
        message: "User created!",
        userId: result._id,
      });
    })
    .catch((err) => {
      console.error(err);
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    });
};

exports.login = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;

  User.findOne({ email })
    .then((user) => {
      if (!user) {
        // ?: If no such user, reject
        const error = new Error("No user with this email");
        error.statusCode = 401;
        throw error;
      }

      loadedUser = user; // ?: Store user into a enclosing variable so that it can be used later
      return bcrypt.compare(password, user.password);
    })
    .then((isEqual) => {
      if (!isEqual) {
        // ?: If wrong password, reject
        const error = new Error("Wrong password");
        error.statusCode = 401;
        throw error;
      }

      const token = jwt.sign(
        {
          email: loadedUser.email,
          userId: loadedUser._id.toString(),
        },
        process.env.JWTSECRET,
        { expiresIn: "1h" }
      );

      res.status(200).json({ token, userId: loadedUser._id.toString() });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
