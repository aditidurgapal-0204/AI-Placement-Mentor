"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  RESUME_FACTS_RESPONSE_SCHEMA,
  validateResumeFacts
} = require("../../contracts/resumeFacts.v1");
const { buildResumeExtractionPrompt, buildResumeExtractionRepairPrompt } = require("./resumeExtractionPrompt.v1");

const RESUME_EXTRACTION_MODEL = "gemini-2.5-flash";

const parseJson = (value) => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new TypeError("Gemini resume extraction must return JSON text or an object.");
  return JSON.parse(value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, ""));
};

const getModel = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing from configuration.");
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: RESUME_EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: RESUME_FACTS_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
};

const extractWithGemini = async ({ resumeText, requestId = "untracked", generate } = {}) => {
  if (typeof resumeText !== "string" || !resumeText.trim()) throw new TypeError("Resume text is required for Gemini extraction.");
  const model = generate ? null : getModel();
  const request = async (prompt) => generate
    ? generate({ prompt })
    : model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      .then((result) => result.response.text());
  const validate = (generated) => {
    const facts = parseJson(generated);
    const validation = validateResumeFacts(facts, { resumeText });
    if (!validation.valid) {
      const error = new Error(`Gemini resume facts are invalid: ${validation.errors.join("; ")}`);
      error.code = "RESUME_FACTS_VALIDATION_FAILED";
      error.validationErrors = validation.errors;
      error.invalidOutput = generated;
      throw error;
    }
    return facts;
  };

  let generated = await request(buildResumeExtractionPrompt({ resumeText }));
  let facts;
  try {
    facts = validate(generated);
  } catch (error) {
    if (error.code !== "RESUME_FACTS_VALIDATION_FAILED") throw error;
    generated = await request(buildResumeExtractionRepairPrompt({
      resumeText,
      invalidOutput: error.invalidOutput,
      validationErrors: error.validationErrors
    }));
    facts = validate(generated);
  }
  console.info("Gemini resume extraction completed", { requestId, model: RESUME_EXTRACTION_MODEL, projects: facts.projects.length });
  return facts;
};

module.exports = { RESUME_EXTRACTION_MODEL, extractWithGemini, parseJson };
