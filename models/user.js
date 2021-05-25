const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    require: true,
  },

  password: {
    type: String,
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    default: "I am new!", // ?: Sets a default argument
  },

  posts: [
    {
      type: Schema.Types.ObjectId,
      ref: "Post", // ?: Creates a reference to the post collection
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
