"use strict";

const { RESUME_FACTS_VERSION, validateResumeFacts } = require("../../contracts/resumeFacts.v1");
const { extractWithGemini, RESUME_EXTRACTION_MODEL } = require("./geminiResumeExtractor");
const { deterministicResumeFacts } = require("./deterministicResumeExtractor");

const EXTRACTION_VERSION = `resume-facts-${RESUME_FACTS_VERSION}`;
const GEMINI_EXTRACTION_VERSION = `${EXTRACTION_VERSION}:${RESUME_EXTRACTION_MODEL}`;
const FALLBACK_EXTRACTION_VERSION = `${EXTRACTION_VERSION}:deterministic`;
const NO_RESUME_EXTRACTION_VERSION = `${EXTRACTION_VERSION}:not-applicable`;

const extractResumeFacts = async (profileData, options = {}) => {
  const resumeText = profileData?.resumeText;
  if (typeof resumeText !== "string" || !resumeText.trim()) {
    return { source: "not_applicable", version: NO_RESUME_EXTRACTION_VERSION, model: null, facts: null, warnings: [] };
  }

  const requestId = options.requestId || "untracked";
  const geminiExtractor = options.geminiExtractor || extractWithGemini;
  const fallbackExtractor = options.fallbackExtractor || deterministicResumeFacts;
  try {
    const facts = await geminiExtractor({ resumeText, requestId, generate: options.generate });
    const validation = validateResumeFacts(facts, { resumeText });
    if (!validation.valid) throw new Error(`Gemini resume facts are invalid: ${validation.errors.join("; ")}`);
    return { source: "gemini", version: GEMINI_EXTRACTION_VERSION, model: RESUME_EXTRACTION_MODEL, facts, warnings: [] };
  } catch (error) {
    const facts = fallbackExtractor({
      resumeText,
      targetRole: profileData.targetRole,
      companyKey: options.companyKey
    });
    const validation = validateResumeFacts(facts, { resumeText });
    if (!validation.valid) throw new Error(`Resume extraction fallback failed: ${validation.errors.join("; ")}`);
    console.warn("Gemini resume extraction failed; deterministic fallback used", { requestId, message: error.message });
    return { source: "deterministic_fallback", version: FALLBACK_EXTRACTION_VERSION, model: null, facts, warnings: [error.message] };
  }
};

module.exports = {
  EXTRACTION_VERSION,
  GEMINI_EXTRACTION_VERSION,
  FALLBACK_EXTRACTION_VERSION,
  NO_RESUME_EXTRACTION_VERSION,
  extractResumeFacts
};
