require("dotenv").config();
const express = require("express");
const cors = require("cors");
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Main App Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);

// 🚀 FIXED PLACEHOLDER ENDPOINT (Added directly to match frontend fetch perfectly)
app.post("/api/ai/generate-analysis", (req, res) => {
  console.log("🚀 Analysis endpoint hit successfully from frontend!");
  
  // Simulate database synthesis delay
  setTimeout(() => {
    return res.status(200).json({
      success: true,
      message: "Profile compiled completely.",
    });
  }, 3500);
});

app.get("/", (req, res) => {
  res.send("Backend Server Running");
});

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});