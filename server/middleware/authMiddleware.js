const jwt = require("jsonwebtoken");

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");

    // Attach user data to request object
    req.user = decoded;

    next();
  } catch (error) {
    console.error("Middleware Auth Verification Error:", error.message);
    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

module.exports = authMiddleware;