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

app.get("/", (req, res) => {
  res.send("Backend Server Running");
});

const PORT = 8000;

app.listen(PORT, (error) => {
  if (error) {
    console.error(`Unable to start server on port ${PORT}: ${error.code || error.message}`);
    return;
  }
  console.log(`Server running on port ${PORT}`);
});
