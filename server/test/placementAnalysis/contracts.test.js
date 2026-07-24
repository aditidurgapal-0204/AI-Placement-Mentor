const assert = require("node:assert/strict");
const test = require("node:test");

const { validateMentorAnalysisV2 } = require("../../contracts/mentorAnalysis.v2");
const {
  validatePresentationSafeGeminiInput,
  validatePresentationSafeGeminiOutput
} = require("../../contracts/presentationSafeGemini.v1");

const semantic = (id, type) => ({
  id,
  type,
  title: "Assessed Capability",
  conclusion: "The student has a meaningful assessed capability.",
  studentMeaning: "This provides a useful foundation for continued placement preparation.",
  roleConnection: "The conclusion is relevant to the selected role competencies.",
  confidence: { value: 0.85, basis: "supported evidence" },
  supportingFacts: { projectExamples: [], skillFacts: [], academicFacts: [], experienceFacts: [], leadershipFacts: [] }
});

const validSnapshot = () => ({
  metadata: {
    id: "analysis-test",
    requestId: "request-test",
    createdAt: "2026-07-19T00:00:00.000Z",
    schemaVersion: "2.0",
    modelVersions: { scoring: "current", competencies: "1.0", reasoning: "1.0", language: "1.0" }
  },
  context: {
    targetRole: "Software Development Engineer (SDE)",
    companyType: "Product Based",
    timelineMonths: 6,
    dailyStudyHours: 4,
    resumeProvided: true
  },
  readiness: {
    score: 54,
    labelKey: "progressing",
    nextLabelKey: "competitive",
    explanation: "Positive preparation evidence is balanced by one assessed score constraint."
  },
  strengths: [semantic("strength-1", "technical_execution")],
  scoreDrivers: [{ ...semantic("driver-1", "preparation_foundation"), contributionIds: ["contribution-1"], scoreEffect: 15 }],
  scoreBlockers: [{ ...semantic("blocker-1", "role_alignment"), contributionIds: ["contribution-2"], scoreEffect: -10 }],
  careerRisks: [{
    ...semantic("risk-1", "professional_exposure"),
    contributionIds: [],
    scoreEffect: 0,
    affectsCurrentScore: false
  }],
  priority: {
    id: "priority-1",
    sourceId: "blocker-1",
    sourceType: "score_blocker",
    objective: "Improve the highest-impact assessed preparation constraint.",
    whyFirst: "It is the largest verified constraint directly affecting readiness.",
    expectedImpact: { readinessScore: true, employabilityConfidence: true }
  },
  preparation: {
    feasibility: "moderate",
    improvementPotential: "meaningful",
    verifiedInputs: ["timelineMonths", "dailyStudyHours", "currentReadiness", "requiredImprovement"]
  },
  internalTrace: { evidenceIds: ["evidence-1"], contributionIds: ["contribution-1", "contribution-2"] }
});

const validGeminiInput = () => ({
  version: "1.0",
  analysisId: "analysis-test",
  context: {
    targetRole: "Software Development Engineer (SDE)",
    companyType: "Product Based",
    timelineMonths: 6,
    dailyStudyHours: 4,
    resumeProvided: true
  },
  readiness: {
    score: 54,
    labelKey: "progressing",
    meaning: "The current result reflects both meaningful preparation and an assessed score constraint."
  },
  strengths: [{
    id: "strength-1",
    title: "Technical Execution",
    conclusion: "The student has demonstrated practical technical execution.",
    studentMeaning: "This provides useful implementation evidence.",
    roleConnection: "It supports the selected role's implementation expectations.",
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], experienceFacts: [], leadershipFacts: [] }
  }],
  scoreBlockers: [{
    id: "blocker-1",
    title: "Core Preparation",
    conclusion: "One assessed foundation remains below the selected target.",
    studentMeaning: "This directly limits the current readiness result.",
    roleConnection: "The selected role requires greater consistency in this area.",
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], experienceFacts: [], leadershipFacts: [] }
  }],
  careerRisks: [{
    id: "risk-1",
    title: "Professional Exposure",
    conclusion: "Professional-context evidence is currently limited.",
    studentMeaning: "This may make workplace readiness harder to demonstrate.",
    roleConnection: "Additional exposure would support recruiter confidence.",
    affectsCurrentScore: false,
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], experienceFacts: [], leadershipFacts: [] }
  }],
  priority: {
    id: "priority-1",
    objective: "Improve the highest-impact assessed constraint.",
    whyFirst: "It directly affects current readiness."
  }
});

test("version 2 mentor analysis contract accepts the approved semantic separation", () => {
  assert.deepEqual(validateMentorAnalysisV2(validSnapshot()), { valid: true, errors: [] });
});

test("score blockers require negative contribution references", () => {
  const snapshot = validSnapshot();
  snapshot.scoreBlockers[0].contributionIds = [];
  snapshot.scoreBlockers[0].scoreEffect = 0;
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("negative contribution references")));
  assert.ok(result.errors.some((error) => error.includes("scoreEffect must be negative")));
});

test("career risks cannot claim current score causality", () => {
  const snapshot = validSnapshot();
  snapshot.careerRisks[0].affectsCurrentScore = true;
  snapshot.careerRisks[0].scoreEffect = -5;
  snapshot.careerRisks[0].contributionIds = ["contribution-3"];
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("affectsCurrentScore")));
  assert.ok(result.errors.some((error) => error.includes("scoreEffect must be zero")));
});

test("mentor insights require confidence and backend-authored meaning", () => {
  const snapshot = validSnapshot();
  delete snapshot.strengths[0].studentMeaning;
  snapshot.strengths[0].confidence.value = 2;
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("studentMeaning")));
  assert.ok(result.errors.some((error) => error.includes("between zero and one")));
});

test("presentation-safe Gemini input accepts semantic conclusions without internal traces", () => {
  assert.deepEqual(validatePresentationSafeGeminiInput(validGeminiInput()), { valid: true, errors: [] });
});

test("presentation-safe Gemini input rejects raw or internal evidence fields at any depth", () => {
  const input = validGeminiInput();
  input.strengths[0].technologies = ["example"];
  input.priority.contributionIds = ["contribution-1"];
  input.context.resumeText = "raw text";
  const result = validatePresentationSafeGeminiInput(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("approved evidence field")));
  assert.ok(result.errors.some((error) => error.includes("contributionIds")));
  assert.ok(result.errors.some((error) => error.includes("resumeText")));
});

test("Gemini output must preserve supplied insight IDs and ordering", () => {
  const input = validGeminiInput();
  const output = {
    analysisId: "analysis-test",
    diagnosis: "A grounded mentor diagnosis.",
    strengths: [{ insightId: "strength-1", text: "A grounded strength." }],
    scoreBlockers: [{ insightId: "blocker-1", text: "A grounded score blocker." }],
    careerRisks: [{ insightId: "risk-1", text: "A grounded career risk." }],
    priority: { insightId: "priority-1", text: "A grounded first priority." }
  };
  assert.deepEqual(validatePresentationSafeGeminiOutput(output, input), { valid: true, errors: [] });

  output.strengths[0].insightId = "invented-strength";
  assert.equal(validatePresentationSafeGeminiOutput(output, input).valid, false);
});

module.exports = { validSnapshot, validGeminiInput };
