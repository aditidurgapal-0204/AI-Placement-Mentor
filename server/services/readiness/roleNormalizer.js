/**
 * server/services/readiness/roleNormalizer.js
 * CANONICAL ROLE MAPPING LAYER
 */

const ROLE_ALIASES = {
  "sde": "Software Development Engineer",
  "software development engineer": "Software Development Engineer",
  "software engineer": "Software Development Engineer",
  "software developer": "Software Development Engineer",
  "full stack developer": "Software Development Engineer",
  "full stack engineer": "Software Development Engineer",
  "fullstack developer": "Software Development Engineer",
  "fullstack engineer": "Software Development Engineer",
  "backend engineer": "Backend Developer",
  "backend developer": "Backend Developer",
  "frontend engineer": "Frontend Developer",
  "frontend developer": "Frontend Developer",
  "front end engineer": "Frontend Developer",
  "front end developer": "Frontend Developer",
  "machine learning engineer": "ML Engineer",
  "ml engineer": "ML Engineer",
  "ai engineer": "ML Engineer",
  "data scientist": "ML Engineer",
  "data analytics": "Data Analyst",
  "data analyst": "Data Analyst"
};

const cleanRoleKey = (targetRole) => String(targetRole || "")
  .trim()
  .toLowerCase()
  .replace(/\([^)]*\)/g, " ")
  .replace(/[/_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const normalizeRole = (targetRole) => {
  if (!targetRole || typeof targetRole !== "string") {
    return "Software Development Engineer";
  }
  const cleanKey = cleanRoleKey(targetRole);
  return ROLE_ALIASES[cleanKey] || targetRole.trim();
};

module.exports = { normalizeRole, cleanRoleKey };
