const CONTRACT_VERSION = "1.0";
const CATEGORIES = ["Content Quality", "Resume Structure", "Skills & Keywords", "Projects / Experience", "Impact & Achievements"];
const STATUSES = new Set(["Strong", "Present", "Needs Improvement", "Missing"]);

const text = (value, max = 260) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const list = (value, max = 8) => Array.isArray(value)
  ? [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, max)
  : [];

const validatePublicResumeAnalysis = (value) => {
  const errors = [];
  if (!value || typeof value !== "object") return { valid: false, errors: ["analysis must be an object"] };
  if (value.contractVersion !== CONTRACT_VERSION) errors.push("contractVersion must be 1.0");
  if (!Number.isInteger(value.atsScore) || value.atsScore < 0 || value.atsScore > 100) errors.push("atsScore must be an integer from 0 to 100");
  if (!text(value.scoreLabel, 60)) errors.push("scoreLabel is required");
  if (!text(value.summary)) errors.push("summary is required");
  if (!Array.isArray(value.scoreBreakdown) || value.scoreBreakdown.length !== CATEGORIES.length) errors.push("scoreBreakdown must contain five categories");
  else value.scoreBreakdown.forEach((item, index) => {
    if (!item || item.category !== CATEGORIES[index] || !Number.isInteger(item.score) || item.score < 0 || item.score > 20 || item.maxScore !== 20) errors.push(`scoreBreakdown[${index}] is invalid`);
  });
  if (Array.isArray(value.scoreBreakdown) && value.scoreBreakdown.reduce((sum, item) => sum + Number(item?.score || 0), 0) !== value.atsScore) errors.push("breakdown total must equal atsScore");
  for (const key of ["strengths", "weaknesses", "recommendations"]) if (list(value[key]).length < 1) errors.push(`${key} must contain usable feedback`);
  if (!Array.isArray(value.sectionFeedback) || !value.sectionFeedback.length) errors.push("sectionFeedback is required");
  else value.sectionFeedback.forEach((item, index) => {
    if (!item || !text(item.section, 80) || !STATUSES.has(item.status) || !text(item.feedback)) errors.push(`sectionFeedback[${index}] is invalid`);
  });
  return { valid: errors.length === 0, errors };
};

module.exports = { CONTRACT_VERSION, CATEGORIES, validatePublicResumeAnalysis };
