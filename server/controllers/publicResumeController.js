const { randomUUID } = require("node:crypto");
const { extractPdfTextFromBuffer } = require("../services/publicPdfTextExtractor");
const { analyzePublicResume } = require("../services/publicResumeAnalyzerService");

const analyzeResume = async (req, res) => {
  const requestId = req.get("X-Request-ID") || randomUUID();
  try {
    if (!req.file) return res.status(400).json({ success: false, code: "FILE_REQUIRED", message: "Select a PDF resume to analyze." });
    if (req.file.mimetype !== "application/pdf" || !req.file.buffer?.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
      return res.status(415).json({ success: false, code: "PDF_REQUIRED", message: "Only a valid PDF resume is supported." });
    }
    let resumeText;
    try {
      resumeText = await extractPdfTextFromBuffer(req.file.buffer);
    } catch {
      return res.status(422).json({ success: false, code: "PDF_UNREADABLE", message: "We couldn’t read this PDF. Try exporting the resume as a text-based PDF and upload it again." });
    }
    if (!resumeText || resumeText.replace(/\s+/g, " ").trim().length < 80) {
      return res.status(422).json({ success: false, code: "PDF_EMPTY", message: "This PDF contains too little readable text for a reliable resume analysis." });
    }
    const analysis = await analyzePublicResume(resumeText, { requestId });
    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error("Public resume analysis failed", { requestId, message: error.message });
    return res.status(500).json({ success: false, code: "ANALYSIS_FAILED", message: "We couldn’t analyze this resume right now. Please try again." });
  }
};

module.exports = { analyzeResume };
