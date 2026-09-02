require("dotenv").config();
const express = require("express");
const cors = require("cors");
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require("./routes/authRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const mockInterviewRoutes = require("./routes/mockInterviewRoutes");
const { config, validateConfig } = require("./config/env");

const app = express();

const developmentOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
const allowedOrigins = new Set(config.isProduction ? config.corsOrigins : [...developmentOrigins, ...config.corsOrigins]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json());

// Main App Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/mock-interview", mockInterviewRoutes);

app.get("/", (req, res) => {
  res.send("Backend Server Running");
});
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.message === "Origin not allowed by CORS") {
    return res.status(403).json({ message: "Origin is not allowed." });
  }
  console.error("Unhandled request error", { method: req.method, path: req.path });
  return res.status(500).json({ message: "Internal server error." });
});

if (require.main === module) {
  try {
    validateConfig();
    app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
  } catch (error) {
    console.error(`Server configuration error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = app;
