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
  facts: { category: type, targetRole: "Software Development Engineer (SDE)" },
  confidence: { value: 0.85, basis: "evidence" },
  supportingFacts: { projectExamples: [], skillFacts: [], academicFacts: [], profileFacts: [], resumeFacts: [] },
  internalTrace: { evidenceIds: ["evidence-1"], contributionIds: [] }
});

const validSnapshot = () => ({
  metadata: {
    id: "analysis-test",
    requestId: "request-test",
    createdAt: "2026-07-19T00:00:00.000Z",
    schemaVersion: "2.1",
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
  scoreDrivers: [{
    ...semantic("driver-1", "preparation_foundation"),
    scoring: { affectsCurrentScore: true, earnedPoints: 15 },
    contributionIds: ["contribution-1"],
    scoreEffect: 15,
    internalTrace: { evidenceIds: ["evidence-1"], contributionIds: ["contribution-1"] }
  }],
  scoreBlockers: [{
    ...semantic("blocker-1", "role_alignment"),
    scoring: { affectsCurrentScore: true, penaltyPoints: -10 },
    contributionIds: ["contribution-2"],
    scoreEffect: -10,
    internalTrace: { evidenceIds: ["evidence-1"], contributionIds: ["contribution-2"] }
  }],
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
    facts: {
      targetInsightType: "score_penalty",
      targetFacts: { category: "role_alignment", targetRole: "Software Development Engineer (SDE)" },
      reason: "largest_current_readiness_gap"
    },
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
  version: "2.0",
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
    explanation: "The current result reflects both meaningful preparation and an assessed score constraint."
  },
  strengths: [{
    id: "strength-1",
    type: "technical_capability",
    title: "Technical Execution",
    facts: { category: "technical_execution", targetRole: "Software Development Engineer (SDE)" },
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], profileFacts: [], resumeFacts: [] }
  }],
  scoreBlockers: [{
    id: "blocker-1",
    type: "score_penalty",
    title: "Core Preparation",
    facts: { category: "role_alignment", targetRole: "Software Development Engineer (SDE)" },
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], profileFacts: [], resumeFacts: [] }
  }],
  careerRisks: [{
    id: "risk-1",
    type: "professional_exposure_gap",
    title: "Professional Exposure",
    facts: { capability: "internship", targetRole: "Software Development Engineer (SDE)" },
    affectsCurrentScore: false,
    evidence: { projectExamples: [], skillFacts: [], academicFacts: [], profileFacts: [], resumeFacts: [] }
  }],
  priority: {
    id: "priority-1",
    sourceId: "blocker-1",
    sourceType: "score_blocker",
    facts: {
      targetInsightType: "score_penalty",
      targetFacts: { category: "role_alignment", targetRole: "Software Development Engineer (SDE)" },
      reason: "largest_current_readiness_gap"
    }
  }
});

test("version 2 mentor analysis contract accepts the approved semantic separation", () => {
  assert.deepEqual(validateMentorAnalysisV2(validSnapshot()), { valid: true, errors: [] });
});

test("score blockers require a current-score gap or penalty", () => {
  const snapshot = validSnapshot();
  snapshot.scoreBlockers[0].scoring = { affectsCurrentScore: true };
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("positive gap or negative penalty")));
});

test("career risks cannot claim current score causality", () => {
  const snapshot = validSnapshot();
  snapshot.careerRisks[0].affectsCurrentScore = true;
  snapshot.careerRisks[0].scoreEffect = -5;
  snapshot.careerRisks[0].contributionIds = ["contribution-3"];
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("affectsCurrentScore")));
});

test("mentor insights require facts, traceability, and confidence", () => {
  const snapshot = validSnapshot();
  delete snapshot.strengths[0].facts;
  delete snapshot.strengths[0].internalTrace;
  snapshot.strengths[0].confidence.value = 2;
  const result = validateMentorAnalysisV2(snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("facts")));
  assert.ok(result.errors.some((error) => error.includes("internalTrace")));
  assert.ok(result.errors.some((error) => error.includes("between zero and one")));
});

test("presentation-safe Gemini input accepts semantic conclusions without internal traces", () => {
  assert.deepEqual(validatePresentationSafeGeminiInput(validGeminiInput()), { valid: true, errors: [] });
});

test("presentation-safe Gemini input rejects raw or internal evidence fields at any depth", () => {
  const input = validGeminiInput();
  input.strengths[0].rawEvidence = ["example"];
  input.priority.contributionIds = ["contribution-1"];
  input.context.resumeText = "raw text";
  const result = validatePresentationSafeGeminiInput(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("rawEvidence")));
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
