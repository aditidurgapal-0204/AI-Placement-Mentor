/**
 * server/services/readiness/roleNormalizer.js
 * CANONICAL ROLE MAPPING LAYER
 */

const ROLE_ALIASES = {
  "sde": "Software Development Engineer",
  "software engineer": "Software Development Engineer",
  "software developer": "Software Development Engineer",
  "full stack developer": "Software Development Engineer",
  "full stack engineer": "Software Development Engineer",
  "backend engineer": "Backend Developer",
  "backend developer": "Backend Developer",
  "frontend engineer": "Frontend Developer",
  "frontend developer": "Frontend Developer",
  "machine learning engineer": "ML Engineer",
  "ai engineer": "ML Engineer",
  "data scientist": "ML Engineer",
  "data analytics": "Data Analyst",
  "data analyst": "Data Analyst"
};

const normalizeRole = (targetRole) => {
  if (!targetRole || typeof targetRole !== "string") {
    return "Software Development Engineer";
  }
  const cleanKey = targetRole.trim().toLowerCase();
  return ROLE_ALIASES[cleanKey] || targetRole;
};

module.exports = { normalizeRole };