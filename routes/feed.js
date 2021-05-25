const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const feedController = require("../controllers/feed");
const isAuth = require("../middleware/is-auth");

// ?: '/feed/posts'
router.get("/posts", isAuth, feedController.getPosts);
router.post(
  "/post",
  isAuth,
  [
    // ?: from express validator to provide server-side validation
    body("title").trim().isLength({ min: 5 }), // ?: Server side validation should match client side
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.createPost
);

router.get("/post/:postId", isAuth, feedController.getPost);

router.put(
  "/post/:postId",
  isAuth,
  [
    body("title").trim().isLength({ min: 5 }), // ?: Server side validation should match client side
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.updatePost
);

router.delete("/post/:postId", isAuth, feedController.deletePost);

router.get("/getStatus", isAuth, feedController.getStatus);

router.put(
  "/updateStatus",
  [body("newStatus", "Please enter a status").trim().isLength({ min: 1 })],
  isAuth,
  feedController.updateStatus
);

module.exports = router;
