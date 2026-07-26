"use strict";

const { RESUME_FACTS_VERSION, CAPABILITIES, validateResumeFacts } = require("../../contracts/resumeFacts.v1");
const { evaluateProjects } = require("../readiness/projectEvaluator");
const { extractResumeMetrics } = require("../readiness/resumeParser");
const { extractLeadershipItems } = require("../readiness/structuredProjectEvidence");

const confidence = 0.8;

const evidenceFor = (resumeText, value) => {
  const candidate = String(value || "").trim();
  const index = resumeText.toLowerCase().indexOf(candidate.toLowerCase());
  if (index < 0) return null;
  return { quote: resumeText.slice(index, index + candidate.length), startOffset: index, endOffset: index + candidate.length };
};

const withEvidence = (resumeText, name, extra = {}) => {
  const evidence = evidenceFor(resumeText, name);
  return evidence ? { name, confidence, evidence, ...extra } : null;
};

const normalizedComplexity = (value) => {
  const result = String(value || "unknown").toLowerCase();
  return ["basic", "intermediate", "advanced"].includes(result) ? result : "unknown";
};

const normalizedRelevance = (value) => {
  const result = String(value || "unknown").toLowerCase();
  return ["low", "medium", "high"].includes(result) ? result : "unknown";
};

const verification = (value) => value === true ? "verified" : "not_verified";

const translateProject = (resumeText, project) => {
  const evidence = evidenceFor(resumeText, project.name);
  if (!evidence) return null;
  return {
    name: project.name,
    technologies: [...new Set(project.technologies || [])],
    capabilities: CAPABILITIES.filter((capability) => project.capabilities?.[capability] === true),
    complexity: normalizedComplexity(project.complexity),
    roleRelevance: normalizedRelevance(project.roleRelevance),
    deployment: verification(project.capabilities?.deployment),
    cloud: verification(project.capabilities?.cloud),
    scalability: verification(project.capabilities?.scalability || project.capabilities?.distributedSystems),
    testing: verification(project.capabilities?.testing),
    confidence,
    evidence
  };
};

const deterministicResumeFacts = ({ resumeText, targetRole, companyKey } = {}) => {
  if (typeof resumeText !== "string" || !resumeText.trim()) return null;

  const projectFacts = evaluateProjects(resumeText, targetRole, companyKey);
  const metrics = extractResumeMetrics(resumeText, projectFacts);
  const leadershipItems = extractLeadershipItems(resumeText);
  const projects = projectFacts.evaluatedProjects.map((project) => translateProject(resumeText, project)).filter(Boolean);

  const experience = [];
  if (metrics.internship?.exists) {
    const name = [metrics.internship.organization, "internship"].filter(Boolean).join(" ");
    const item = withEvidence(resumeText, metrics.internship.organization || "internship", { kind: "internship" });
    if (item) experience.push({ ...item, name });
  }

  const certifications = (metrics.certificationEntries || [])
    .map((name) => withEvidence(resumeText, name, { kind: "certification" })).filter(Boolean);
  const leadership = leadershipItems
    .map((entry) => withEvidence(resumeText, entry.evidence, { organization: entry.organization || null })).filter(Boolean);
  const activities = [
    ...(metrics.activities?.publicSpeaking || []).map((name) => ({ name, kind: "public_speaking" })),
    ...(metrics.activities?.societyParticipation || []).map((name) => ({ name, kind: "society_participation" })),
    ...(metrics.activities?.volunteering || []).map((name) => ({ name, kind: "volunteering" })),
    ...(metrics.activities?.measurableAchievements || []).map((name) => ({ name, kind: "achievement" }))
  ].map(({ name, kind }) => withEvidence(resumeText, name, { kind })).filter(Boolean);
  const skills = (metrics.detectedTechnologies || [])
    .map((name) => withEvidence(resumeText, name, { kind: "technical_skill" })).filter(Boolean);
  const portfolioLinks = metrics.hasGitHub
    ? [withEvidence(resumeText, /git(?:hub|lab)/i.exec(resumeText)?.[0] || "GitHub", { kind: "github" })].filter(Boolean)
    : [];

  const facts = {
    schemaVersion: RESUME_FACTS_VERSION,
    resumeStatus: "assessed",
    projects,
    experience,
    certifications,
    leadership,
    activities,
    achievements: [],
    skills,
    portfolioLinks,
    warnings: ["Gemini extraction was unavailable; the deterministic fallback was used."]
  };
  const validation = validateResumeFacts(facts, { resumeText });
  if (!validation.valid) throw new Error(`Deterministic resume facts are invalid: ${validation.errors.join("; ")}`);
  return facts;
};

module.exports = { deterministicResumeFacts };
