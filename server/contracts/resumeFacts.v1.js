"use strict";

/**
 * The only contract accepted from a resume-extraction provider.  The contract
 * deliberately contains evidence pointers instead of raw resume text so that
 * later stages can prove each score-affecting claim.
 */
const RESUME_FACTS_VERSION = "1.0";

const CAPABILITIES = Object.freeze([
  "frontend", "backend", "databaseIntegration", "authentication", "deployment",
  "cloud", "scalability", "distributedSystems", "systemDesign", "testing",
  "machineLearning", "recommendationSystem", "featureEngineering",
  "dataPreprocessing", "dataEngineering", "dataAnalysis", "accessibility", "realtime"
]);

const COMPLEXITIES = new Set(["basic", "intermediate", "advanced", "unknown"]);
const RELEVANCE = new Set(["low", "medium", "high", "unknown"]);
const VERIFICATION = new Set(["verified", "not_verified", "unknown"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const uniqueStrings = (values) => Array.isArray(values)
  && values.every(isNonEmptyString)
  && new Set(values.map((value) => value.trim().toLowerCase())).size === values.length;
const rejectUnknownKeys = (value, allowed, path, errors) => {
  if (!isObject(value)) return;
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not supported`);
  });
};

const validateEvidence = (evidence, path, errors, resumeText) => {
  if (!isObject(evidence)) {
    errors.push(`${path}.evidence must be an object`);
    return;
  }
  rejectUnknownKeys(evidence, new Set(["quote", "startOffset", "endOffset"]), `${path}.evidence`, errors);
  if (!isNonEmptyString(evidence.quote)) errors.push(`${path}.evidence.quote is required`);
  if (!Number.isInteger(evidence.startOffset) || evidence.startOffset < 0) {
    errors.push(`${path}.evidence.startOffset must be a non-negative integer`);
  }
  if (!Number.isInteger(evidence.endOffset) || evidence.endOffset <= evidence.startOffset) {
    errors.push(`${path}.evidence.endOffset must be after startOffset`);
  }
  if (typeof resumeText !== "string" || !isNonEmptyString(evidence.quote)) return;

  const exactSlice = resumeText.slice(evidence.startOffset, evidence.endOffset);
  if (exactSlice !== evidence.quote) {
    errors.push(`${path}.evidence offsets must point to the exact quote`);
  }
};

const validateConfidence = (value, path, errors) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${path}.confidence must be a number between zero and one`);
  }
};

const validateProject = (project, index, errors, resumeText) => {
  const path = `projects[${index}]`;
  if (!isObject(project)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(project, new Set([
    "name", "technologies", "capabilities", "complexity", "roleRelevance",
    "deployment", "cloud", "scalability", "testing", "confidence", "evidence"
  ]), path, errors);
  if (!isNonEmptyString(project.name)) errors.push(`${path}.name is required`);
  if (!uniqueStrings(project.technologies || [])) errors.push(`${path}.technologies must contain unique strings`);
  if (!Array.isArray(project.capabilities)
    || !project.capabilities.every((capability) => CAPABILITIES.includes(capability))
    || new Set(project.capabilities).size !== project.capabilities.length) {
    errors.push(`${path}.capabilities must contain supported capability values`);
  }
  if (!COMPLEXITIES.has(project.complexity)) errors.push(`${path}.complexity is invalid`);
  if (!RELEVANCE.has(project.roleRelevance)) errors.push(`${path}.roleRelevance is invalid`);
  ["deployment", "cloud", "scalability", "testing"].forEach((name) => {
    if (!VERIFICATION.has(project[name])) errors.push(`${path}.${name} is invalid`);
  });
  validateConfidence(project.confidence, path, errors);
  validateEvidence(project.evidence, path, errors, resumeText);
};

const validateEvidenceCollection = (value, name, errors, resumeText) => {
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array`);
    return;
  }
  value.forEach((entry, index) => {
    const path = `${name}[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${path} must be an object`);
      return;
    }
    rejectUnknownKeys(entry, new Set(["name", "kind", "organization", "confidence", "evidence"]), path, errors);
    if (!isNonEmptyString(entry.name)) errors.push(`${path}.name is required`);
    validateConfidence(entry.confidence, path, errors);
    validateEvidence(entry.evidence, path, errors, resumeText);
  });
};

const validateResumeFacts = (facts, { resumeText } = {}) => {
  const errors = [];
  if (!isObject(facts)) return { valid: false, errors: ["resume facts must be an object"] };
  rejectUnknownKeys(facts, new Set([
    "schemaVersion", "resumeStatus", "projects", "experience", "certifications", "leadership",
    "activities", "achievements", "skills", "portfolioLinks", "warnings"
  ]), "resume facts", errors);
  if (facts.schemaVersion !== RESUME_FACTS_VERSION) errors.push(`schemaVersion must be ${RESUME_FACTS_VERSION}`);
  if (facts.resumeStatus !== "assessed") errors.push("resumeStatus must be assessed");

  if (!Array.isArray(facts.projects)) errors.push("projects must be an array");
  else facts.projects.forEach((project, index) => validateProject(project, index, errors, resumeText));

  ["experience", "certifications", "leadership", "activities", "achievements", "skills", "portfolioLinks"]
    .forEach((name) => validateEvidenceCollection(facts[name], name, errors, resumeText));

  if (!Array.isArray(facts.warnings) || !facts.warnings.every(isNonEmptyString)) {
    errors.push("warnings must be an array of strings");
  }

  const names = (facts.projects || []).map((project) => String(project?.name || "").trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) errors.push("projects must not contain duplicate names");

  return { valid: errors.length === 0, errors };
};

const EVIDENCE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    quote: { type: "string" },
    startOffset: { type: "integer" },
    endOffset: { type: "integer" }
  },
  required: ["quote", "startOffset", "endOffset"]
};

const NAMED_EVIDENCE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    kind: { type: "string" },
    organization: { type: "string", nullable: true },
    confidence: { type: "number" },
    evidence: EVIDENCE_RESPONSE_SCHEMA
  },
  required: ["name", "confidence", "evidence"]
};

const PROJECT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    technologies: { type: "array", items: { type: "string" } },
    capabilities: { type: "array", items: { type: "string", enum: CAPABILITIES } },
    complexity: { type: "string", enum: [...COMPLEXITIES] },
    roleRelevance: { type: "string", enum: [...RELEVANCE] },
    deployment: { type: "string", enum: [...VERIFICATION] },
    cloud: { type: "string", enum: [...VERIFICATION] },
    scalability: { type: "string", enum: [...VERIFICATION] },
    testing: { type: "string", enum: [...VERIFICATION] },
    confidence: { type: "number" },
    evidence: EVIDENCE_RESPONSE_SCHEMA
  },
  required: [
    "name", "technologies", "capabilities", "complexity", "roleRelevance", "deployment", "cloud",
    "scalability", "testing", "confidence", "evidence"
  ]
};

const RESUME_FACTS_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: [RESUME_FACTS_VERSION] },
    resumeStatus: { type: "string", enum: ["assessed"] },
    projects: { type: "array", items: PROJECT_RESPONSE_SCHEMA },
    experience: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    certifications: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    leadership: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    activities: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    achievements: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    skills: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    portfolioLinks: { type: "array", items: NAMED_EVIDENCE_RESPONSE_SCHEMA },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: [
    "schemaVersion", "resumeStatus", "projects", "experience", "certifications", "leadership",
    "activities", "achievements", "skills", "portfolioLinks", "warnings"
  ]
});

module.exports = {
  RESUME_FACTS_VERSION,
  CAPABILITIES,
  RESUME_FACTS_RESPONSE_SCHEMA,
  validateResumeFacts
};
