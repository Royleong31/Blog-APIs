require("dotenv").config();

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // console.log(`-------: ${req.get("Authorization")}`);
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    const error = new Error("Not authenticated");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];
  let decodedToken;

  try { // ?: catch error if jwt cannot be verified
    decodedToken = jwt.verify(token, process.env.JWTSECRET);
  } catch (error) {
    error.statusCode = 500;
    throw error;
  }

  if (!decodedToken) {
    const error = new Error("Not authenticated");
    error.statusCode = 401;
    throw error;
  }
  console.log(decodedToken.userId);

  req.userId = decodedToken.userId; // ?: Stores the user's _id into the req object
  next();
};
