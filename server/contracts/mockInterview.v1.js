const INTERVIEW_VERSION = "1.0";
const INTERVIEW_TYPES = new Set(["hr", "technical"]);
const QUESTION_LIMITS = new Set([5, 10]);
const TARGET_ROLES = new Set(["Software Development Engineer (SDE)", "ML Engineer", "Data Analyst", "Frontend Developer"]);
const QUESTION_CATEGORIES = {
  hr: new Set(["introduction", "strengths", "weaknesses", "teamwork", "conflict", "leadership", "failure", "challenges", "goals", "motivation", "pressure", "communication", "fit"]),
  technical: new Set(["project", "skill", "fundamentals", "problem-solving"])
};
const DIMENSIONS = {
  hr: ["Answer Relevance", "Clarity", "Response Structure", "Professionalism", "Communication Quality", "Assertiveness"],
  technical: ["Technical Knowledge", "Concept Clarity", "Answer Accuracy", "Problem Solving", "Explanation Quality", "Resume Knowledge"]
};

const cleanText = (value, max = 500) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const cleanList = (value, max = 4) => Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item, 240)).filter(Boolean))].slice(0, max) : [];

const validateSetup = ({ type, questionLimit, targetRole }) => {
  const errors = [];
  if (!INTERVIEW_TYPES.has(type)) errors.push("Interview type must be hr or technical.");
  if (!QUESTION_LIMITS.has(Number(questionLimit))) errors.push("Interview length must be 5 or 10 questions.");
  if (type === "technical" && !TARGET_ROLES.has(targetRole)) errors.push("Select a supported target role.");
  return { valid: errors.length === 0, errors };
};

const normalizeQuestion = (value, type) => {
  if (!value || typeof value !== "object") return null;
  const question = cleanText(value.question, 360);
  const category = cleanText(value.category, 40).toLowerCase();
  const topic = cleanText(value.topic, 80);
  if (question.length < 12 || !QUESTION_CATEGORIES[type]?.has(category) || !topic) return null;
  return { question, category, topic, isFollowUp: value.isFollowUp === true };
};

const normalizeEvaluation = (value, type) => {
  if (!value || typeof value !== "object" || !value.ratings || typeof value.ratings !== "object") return null;
  const ratings = {};
  for (const dimension of DIMENSIONS[type]) {
    const rating = Number(value.ratings[dimension]);
    if (!Number.isInteger(rating) || rating < 0 || rating > 4) return null;
    ratings[dimension] = rating;
  }
  const whatWentWell = cleanList(value.whatWentWell);
  const improvements = cleanList(value.improvements);
  const betterApproach = cleanText(value.betterApproach, 500);
  if (!whatWentWell.length || !improvements.length || !betterApproach) return null;
  return { ratings, whatWentWell, improvements, betterApproach };
};

module.exports = { INTERVIEW_VERSION, INTERVIEW_TYPES, QUESTION_LIMITS, TARGET_ROLES, QUESTION_CATEGORIES, DIMENSIONS, cleanText, validateSetup, normalizeQuestion, normalizeEvaluation };
