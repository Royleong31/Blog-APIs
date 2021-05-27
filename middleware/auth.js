require("dotenv").config();

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.get("Authorization");
  
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }

  const token = authHeader.split(" ")[1];
  let decodedToken;

  try {
    // ?: catch error if jwt cannot be verified
    decodedToken = jwt.verify(token, process.env.JWTSECRET);
  } catch (error) {
    req.isAuth = false;
    return next();
  }

  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }

  req.userId = decodedToken.userId; // ?: Stores the user's _id into the req object
  req.isAuth = true;
  next();
};
