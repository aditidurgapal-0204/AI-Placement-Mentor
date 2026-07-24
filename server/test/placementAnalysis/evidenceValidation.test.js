const assert = require("node:assert/strict");
const test = require("node:test");

const { profiles } = require("./fixtures/profileFixtures");
const { normalizeRole } = require("../../services/readiness/roleNormalizer");
const { getCompanyRules } = require("../../services/readiness/companyRules");
const { evaluateProjects } = require("../../services/readiness/projectEvaluator");
const { extractResumeMetrics } = require("../../services/readiness/resumeParser");
const { buildCanonicalEvidence } = require("../../services/placementAnalysis/canonicalEvidenceService");
const {
  validateEvidenceItem,
  validateCanonicalEvidence,
  selectReasoningEvidence,
  createPublicEvidenceSummary
} = require("../../services/placementAnalysis/evidenceValidationService");

const canonicalFor = (profile) => {
  const role = normalizeRole(profile.targetRole);
  const company = getCompanyRules(profile.companyType);
  const projects = evaluateProjects(profile.resumeText, role, company.key);
  return buildCanonicalEvidence({
    profileData: profile,
    resumeEvidence: extractResumeMetrics(profile.resumeText, projects)
  });
};

test("validation rejects unsupported evidence before reasoning", () => {
  const model = canonicalFor(profiles.fullStack);
  const unsupported = {
    ...model.evidence[0],
    id: "invalid-id",
    type: "invented_capability",
    verificationStatus: "unverified",
    confidence: 2
  };
  const result = validateEvidenceItem(unsupported);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("id must be a canonical evidence ID"));
  assert.ok(result.errors.includes("type is not supported"));
  assert.ok(result.errors.includes("verification status is not accepted"));
  assert.ok(result.errors.includes("confidence must be between zero and one"));
});

test("canonical validation rejects duplicate evidence IDs", () => {
  const model = canonicalFor(profiles.fullStack);
  model.evidence.push({ ...model.evidence[0] });
  const result = validateCanonicalEvidence(model);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate evidence ID")));
});

test("reasoning selection separates accepted and rejected evidence", () => {
  const model = canonicalFor(profiles.backend);
  const invalid = { ...model.evidence[0], confidence: -1 };
  model.evidence.push(invalid);
  const selection = selectReasoningEvidence(model);

  assert.equal(selection.accepted.length, model.evidence.length - 1);
  assert.equal(selection.rejected.length, 1);
  assert.ok(selection.rejected[0].reasons.some((reason) => reason.includes("confidence")));
});

test("public evidence summary exposes only aggregates and confidence bands", () => {
  const model = canonicalFor(profiles.machineLearning);
  const summary = createPublicEvidenceSummary(model);
  const serialized = JSON.stringify(summary);

  assert.ok(summary.counts.total > 0);
  assert.ok(summary.counts.byDomain.profile > 0);
  assert.ok(summary.counts.byDomain.resume > 0);
  assert.ok(summary.counts.byConfidence.high > 0);
  ["value", "provenance", "source", "path", "evidence-", "collaborative filtering"]
    .forEach((forbidden) => assert.equal(serialized.includes(forbidden), false));
});

test("confidence bands characterize supported and verified provenance", () => {
  const model = canonicalFor(profiles.fullStack);
  const summary = createPublicEvidenceSummary(model);
  assert.ok(summary.counts.byConfidence.high > 0);
  assert.equal(summary.counts.byConfidence.low, 0);
});
