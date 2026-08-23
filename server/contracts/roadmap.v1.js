const ROADMAP_VERSION = "1.0";
const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

const cleanText = (value, maxLength = 180) => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
  : "";

const cleanList = (value, maxItems) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((item) => cleanText(item, 160)).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxItems);
};

const normalizeRoadmap = (value, expectedMonths, expectedRole) => {
  const months = Number(expectedMonths);
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) return null;
  if (!value || typeof value !== "object" || !Array.isArray(value.roadmap) || value.roadmap.length !== months) return null;

  const roadmap = value.roadmap.map((item, index) => {
    if (!item || typeof item !== "object" || Number(item.month) !== index + 1) return null;
    const title = cleanText(item.title, 80);
    const focus = cleanText(item.focus, 220);
    const topics = cleanList(item.topics, 8);
    const goals = cleanList(item.goals, 8);
    if (!title || !focus || topics.length < 2 || goals.length < 2) return null;
    return { month: index + 1, title, focus, topics, goals };
  });
  if (roadmap.some((month) => month === null)) return null;

  return {
    contractVersion: ROADMAP_VERSION,
    durationMonths: months,
    targetRole: cleanText(expectedRole, 100) || "Placement preparation",
    source: value.source === "gemini" ? "gemini" : "deterministic_fallback",
    roadmap
  };
};

module.exports = { ROADMAP_VERSION, MIN_MONTHS, MAX_MONTHS, normalizeRoadmap };
