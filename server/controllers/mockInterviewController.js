const { randomUUID } = require("node:crypto");
const { extractPdfTextFromBuffer } = require("../services/publicPdfTextExtractor");
const mockInterviewService = require("../services/mockInterviewService");

const safeError = (res, error, requestId) => {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error("Public mock interview request failed", { requestId, message: error.message });
  return res.status(status).json({ success: false, code: error.code || "INTERVIEW_FAILED", message: status >= 500 ? "The interview could not continue right now. Your submitted answers have been preserved; please retry." : error.message });
};

const startInterview = async (req, res) => {
  const requestId = req.get("X-Request-ID") || randomUUID();
  try {
    const type = String(req.body?.type || "").trim().toLowerCase();
    let resumeText = null;
    if (type === "technical") {
      if (!req.file) return res.status(400).json({ success: false, code: "RESUME_REQUIRED", message: "Upload a PDF resume to start a technical interview." });
      if (req.file.mimetype !== "application/pdf" || !req.file.buffer?.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return res.status(415).json({ success: false, code: "PDF_REQUIRED", message: "Only a valid PDF resume is supported." });
      try { resumeText = await extractPdfTextFromBuffer(req.file.buffer); }
      catch { return res.status(422).json({ success: false, code: "PDF_UNREADABLE", message: "We couldn’t read this PDF. Export it as a text-based PDF and try again." }); }
      if (!resumeText || resumeText.replace(/\s+/g, " ").trim().length < 80) return res.status(422).json({ success: false, code: "PDF_EMPTY", message: "This PDF contains too little readable text for a technical interview." });
    }
    const interview = mockInterviewService.startInterview({ type, questionLimit: Number(req.body?.questionLimit), targetRole: req.body?.targetRole, resumeText });
    return res.status(201).json({ success: true, interview });
  } catch (error) { return safeError(res, error, requestId); }
};

const answerQuestion = async (req, res) => {
  const requestId = req.get("X-Request-ID") || randomUUID();
  try {
    const result = await mockInterviewService.submitAnswer(req.params.interviewId, req.body?.answer, { requestId });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { return safeError(res, error, requestId); }
};

module.exports = { startInterview, answerQuestion };
