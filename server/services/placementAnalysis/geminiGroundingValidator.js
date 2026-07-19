const { validatePresentationSafeGeminiOutput } = require("../../contracts/presentationSafeGemini.v1");

const numberTokens = (value) => String(value || "").match(/\b\d+(?:\.\d+)?\b/g) || [];
const collectApprovedNumbers = (input) => new Set(numberTokens(JSON.stringify(input)));
const outputTexts = (output) => [
  output?.diagnosis,
  ...(output?.strengths || []).map(({ text }) => text),
  ...(output?.scoreBlockers || []).map(({ text }) => text),
  ...(output?.careerRisks || []).map(({ text }) => text),
  output?.priority?.text
].filter((value) => typeof value === "string");

const INTERNAL_LANGUAGE = /\b(?:verified evidence(?: supports)?|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration|score contribution|capability family|reasoning dimension|confidence aggregation)\b/i;
const sentenceCount = (value) => (String(value || "").match(/[.!?](?:\s|$)/g) || []).length;
const wordCount = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;

const validateGeminiGrounding = (output, input) => {
  const contract = validatePresentationSafeGeminiOutput(output, input);
  const errors = [...contract.errors];
  const approvedNumbers = collectApprovedNumbers(input);

  if (typeof output?.diagnosis === "string") {
    const sentences = sentenceCount(output.diagnosis);
    const words = wordCount(output.diagnosis);
    if (sentences < 3 || sentences > 5) errors.push("diagnosis must contain between three and five complete sentences");
    if (words < 45 || words > 120) errors.push("diagnosis must contain between 45 and 120 words");
  }

  outputTexts(output).forEach((value, index) => {
    if (INTERNAL_LANGUAGE.test(value)) errors.push(`output text ${index} contains internal analytics language`);
    numberTokens(value).forEach((number) => {
      if (!approvedNumbers.has(number)) errors.push(`output text ${index} contains unapproved numeric claim ${number}`);
    });
  });

  (output?.careerRisks || []).forEach(({ text }, index) => {
    const claimsScoreEffect = /\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?|costs?)\b[^.]{0,50}\b(?:score|readiness points?)\b|\b(?:score|readiness points?)\b[^.]{0,50}\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?)\b/i.test(text || "");
    const explicitlyNegatesScoreEffect = /\b(?:does|did|will|would|can)\s+not\s+(?:lower|reduce|decrease|deduct|cost)\b/i.test(text || "");
    if (claimsScoreEffect && !explicitlyNegatesScoreEffect) {
      errors.push(`careerRisks[${index}] must not claim current score causality`);
    }
  });

  return { valid: errors.length === 0, errors };
};

module.exports = { validateGeminiGrounding };
