const jwt = require("jsonwebtoken");
const { config } = require("../config/env");

const authMiddleware = (req, res, next) => {
  try {
    // 1. Grab the raw authorization string from headers
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // 2. SAFE TOKEN EXTRACTION
    // If the header starts with "Bearer ", extract just the token part.
    // Otherwise, fall back to using the raw header string directly.
    let token = authHeader;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 3. Verify the clean, isolated token string
    if (!config.jwtSecret) throw new Error("Authentication is not configured");
    const decoded = jwt.verify(token, config.jwtSecret);

    // Attach user data to request object
    req.user = decoded;

    next();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("Middleware auth verification failed");
    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

module.exports = authMiddleware;
