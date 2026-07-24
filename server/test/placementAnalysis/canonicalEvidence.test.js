const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeRole } = require("../../services/readiness/roleNormalizer");
const { getCompanyRules } = require("../../services/readiness/companyRules");
const { evaluateProjects } = require("../../services/readiness/projectEvaluator");
const { extractResumeMetrics } = require("../../services/readiness/resumeParser");
const { buildCanonicalEvidence } = require("../../services/placementAnalysis/canonicalEvidenceService");
const { validateCanonicalEvidence, createPublicEvidenceSummary } = require("../../services/placementAnalysis/evidenceValidationService");
const { profiles, profileWith } = require("./fixtures/profileFixtures");

const canonicalFor = (profile) => {
  const role = normalizeRole(profile.targetRole);
  const company = getCompanyRules(profile.companyType);
  const projects = evaluateProjects(profile.resumeText, role, company.key);
  const resumeEvidence = extractResumeMetrics(profile.resumeText, projects);
  return buildCanonicalEvidence({ profileData: profile, resumeEvidence });
};

test("canonical evidence is deterministic and valid for representative profiles", () => {
  for (const profile of Object.values(profiles)) {
    const first = canonicalFor(profile);
    const second = canonicalFor(profile);
    assert.deepEqual(second, first);
    assert.deepEqual(validateCanonicalEvidence(first), { valid: true, errors: [] });
    assert.equal(new Set(first.evidence.map(({ id }) => id)).size, first.evidence.length);
  }
});

test("canonical profile evidence preserves verified preparation context", () => {
  const model = canonicalFor(profiles.noResume);
  const values = Object.fromEntries(model.evidence.filter(({ domain }) => domain === "profile")
    .map(({ capability, value }) => [capability, value]));

  assert.equal(values.target_role, "Software Development Engineer");
  assert.equal(values.company_type, "Product Based");
  assert.equal(values.timeline_months, 6);
  assert.equal(values.daily_study_hours, 4);
  assert.equal(values.cgpa, 8.2);
});

test("no-resume state is not converted into verified resume absence", () => {
  const model = canonicalFor(profiles.noResume);
  assert.equal(model.assessment.resumeStatus, "not_assessed");
  assert.equal(model.evidence.some(({ domain }) => domain === "resume"), false);
  assert.equal(model.evidence.some(({ capability }) => capability === "internship"), false);
});

test("canonical project capability evidence remains isolated by project provenance", () => {
  const resumeText = `PROJECTS
Secure Service | Current
Built an API with authentication and a database.
Public Interface | Current
Built a responsive interface.
EDUCATION
Bachelor of Engineering`;
  const profile = profileWith({ resumeText });
  const model = canonicalFor(profile);
  const authentication = model.evidence.filter(({ type, capability }) => type === "demonstrated_capability" && capability === "authentication");
  const frontend = model.evidence.filter(({ type, capability }) => type === "demonstrated_capability" && capability === "frontend");

  assert.equal(authentication.length, 1);
  assert.match(authentication[0].provenance.path, /^projects\[0\]/);
  assert.ok(frontend.some(({ provenance }) => /^projects\[1\]/.test(provenance.path)));
  assert.equal(authentication.some(({ provenance }) => /^projects\[1\]/.test(provenance.path)), false);
});

test("verified resume signals become typed evidence without storing resume text", () => {
  const profile = profileWith({
    resumeText: `PROJECTS
Portfolio Tool | Current
Built and deployed a responsive interface.
EXTRA-CURRICULAR ACTIVITIES
Team Coordinator - Student Society
CERTIFICATIONS
- Professional Learning Program
OTHER
GitHub profile`
  });
  const model = canonicalFor(profile);
  const capabilities = new Set(model.evidence.map(({ capability }) => capability));

  assert.ok(capabilities.has("leadership"));
  assert.ok(capabilities.has("certification"));
  assert.ok(capabilities.has("code_portfolio"));
  assert.equal(JSON.stringify(model).includes(profile.resumeText), false);
});

test("raw unfamiliar technology remains internal and is excluded from public evidence summary", () => {
  const model = canonicalFor(profiles.unfamiliar);
  const internalValues = model.evidence.filter(({ type }) => type === "technology_exposure").map(({ value }) => value);
  const summary = createPublicEvidenceSummary(model);

  assert.ok(internalValues.includes("NovaFrame"));
  assert.ok(internalValues.includes("OrbitStore"));
  assert.equal(JSON.stringify(summary).includes("NovaFrame"), false);
  assert.equal(JSON.stringify(summary).includes("OrbitStore"), false);
  assert.equal("evidence" in summary, false);
});

module.exports = { canonicalFor };
