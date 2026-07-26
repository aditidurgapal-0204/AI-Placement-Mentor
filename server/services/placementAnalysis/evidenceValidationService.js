const { MENTOR_REASONING_RULES } = require("../../configs/mentorReasoningRules.v1");
const { CANONICAL_EVIDENCE_VERSION } = require("./canonicalEvidenceService");

const ALLOWED_DOMAINS = new Set(["profile", "resume"]);
const ALLOWED_TYPES = new Set([
  "skill_level", "academic_context", "academic_performance", "placement_goal", "preparation_context",
  "demonstrated_capability", "demonstrated_method", "technology_exposure", "evidence_depth",
  "professional_experience", "responsibility_evidence", "research_evidence", "collaboration_evidence",
  "practice_evidence", "participation_evidence", "portfolio_evidence", "learning_evidence"
  , "resume_evidence_status", "project_evidence", "activity_evidence"
]);

const validateEvidenceItem = (item) => {
  const errors = [];
  if (!item || typeof item !== "object" || Array.isArray(item)) return { valid: false, errors: ["evidence item must be an object"] };
  if (typeof item.id !== "string" || !/^evidence-[a-f0-9]{16}$/.test(item.id)) errors.push("id must be a canonical evidence ID");
  if (!ALLOWED_DOMAINS.has(item.domain)) errors.push("domain is not supported");
  if (!ALLOWED_TYPES.has(item.type)) errors.push("type is not supported");
  if (typeof item.capability !== "string" || !item.capability) errors.push("capability is required");
  if (item.value === undefined || item.value === null) errors.push("value is required");
  if (!MENTOR_REASONING_RULES.evidence.acceptedStatuses.includes(item.verificationStatus)) errors.push("verification status is not accepted");
  if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence)
    || item.confidence < 0 || item.confidence > 1) errors.push("confidence must be between zero and one");
  if (!item.provenance || typeof item.provenance.source !== "string" || typeof item.provenance.path !== "string") {
    errors.push("provenance source and path are required");
  }
  return { valid: errors.length === 0, errors };
};

const validateCanonicalEvidence = (model) => {
  const errors = [];
  if (!model || typeof model !== "object" || Array.isArray(model)) return { valid: false, errors: ["canonical model must be an object"] };
  if (model.version !== CANONICAL_EVIDENCE_VERSION) {
    errors.push(`canonical evidence version must be ${CANONICAL_EVIDENCE_VERSION}`);
  }
  if (!model.assessment || !["assessed", "not_assessed"].includes(model.assessment.resumeStatus)) {
    errors.push("assessment.resumeStatus is invalid");
  }
  if (!Array.isArray(model.evidence)) return { valid: false, errors: [...errors, "evidence must be an array"] };

  const seen = new Set();
  model.evidence.forEach((item, index) => {
    const result = validateEvidenceItem(item);
    result.errors.forEach((error) => errors.push(`evidence[${index}]: ${error}`));
    if (seen.has(item?.id)) errors.push(`evidence[${index}]: duplicate evidence ID`);
    if (item?.id) seen.add(item.id);
  });
  return { valid: errors.length === 0, errors };
};

const selectReasoningEvidence = (model) => {
  const accepted = [];
  const rejected = [];
  (model?.evidence || []).forEach((item) => {
    const validation = validateEvidenceItem(item);
    if (validation.valid) accepted.push(item);
    else rejected.push({ id: item?.id || null, reasons: validation.errors });
  });
  return { accepted, rejected };
};

const confidenceBand = (confidence) => {
  const bands = MENTOR_REASONING_RULES.evidence.confidenceBands;
  if (confidence >= bands.high.minimum) return "high";
  if (confidence >= bands.medium.minimum) return "medium";
  return "low";
};

const createPublicEvidenceSummary = (model) => {
  const { accepted } = selectReasoningEvidence(model);
  const byDomain = {};
  const byType = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };
  accepted.forEach((item) => {
    byDomain[item.domain] = (byDomain[item.domain] || 0) + 1;
    byType[item.type] = (byType[item.type] || 0) + 1;
    byConfidence[confidenceBand(item.confidence)] += 1;
  });
  return {
    version: model?.version,
    assessment: model?.assessment,
    counts: { total: accepted.length, byDomain, byType, byConfidence }
  };
};

module.exports = {
  ALLOWED_DOMAINS,
  ALLOWED_TYPES,
  validateEvidenceItem,
  validateCanonicalEvidence,
  selectReasoningEvidence,
  createPublicEvidenceSummary
};
