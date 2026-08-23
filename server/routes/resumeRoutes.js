const express = require("express");
const multer = require("multer");
const { analyzeResume } = require("../controllers/publicResumeController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

router.post("/analyze", (req, res) => {
  upload.single("resume")(req, res, (error) => {
    if (!error) return analyzeResume(req, res);
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, code: "FILE_TOO_LARGE", message: "The PDF must be 5 MB or smaller." });
    }
    return res.status(400).json({ success: false, code: "UPLOAD_INVALID", message: "The resume upload could not be processed." });
  });
});

module.exports = router;
