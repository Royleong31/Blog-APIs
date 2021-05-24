const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const feedController = require("../controllers/feed");

// ?: '/feed/posts'
router.get("/posts", feedController.getPosts);
router.post(
  "/post",
  [
    // ?: from express validator to provide server-side validation
    body("title").trim().isLength({ min: 5 }), // ?: Server side validation should match client side
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.createPost
);

router.get("/post/:postId", feedController.getPost);

router.put(
  "/post/:postId",
  [
    body("title").trim().isLength({ min: 5 }), // ?: Server side validation should match client side
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.updatePost
);

module.exports = router;