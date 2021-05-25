const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const authController = require("../controllers/auth");
const user = require("../models/user");

router.put(
  "/signup",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom((value, { req }) => {
        return user.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email address already exists"); // ?: Use a promise so that express validator will wait
          }
        });
      })
      .normalizeEmail(),
    body("password").trim().isLength({ min: 5 }),
    body("name").trim().isLength({ min: 5 }),
  ],
  authController.signup
);

router.post("/login", authController.login);

module.exports = router;
