const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profileWith, profiles } = require("./fixtures/profileFixtures");

const create = (profile, id) => createMentorAnalysisSnapshot(profile, {
  analysisId: `analysis-${id}`, requestId: `request-${id}`, createdAt: "2026-07-20T00:00:00.000Z"
});

test("skill gaps become student-facing score blockers while target-alignment penalties do not", () => {
  const snapshot = create(profileWith({
    companyType: "MAANG",
    skills: { dsa: "Beginner", os: "Beginner" },
    resumeText: null
  }), "score-blocker");

  assert.ok(snapshot.scoreBlockers.length > 0);
  assert.ok(snapshot.scoreBlockers.every((blocker) => blocker.facts?.category !== "target_alignment"));
  assert.ok(snapshot.scoreBlockers.some((blocker) => blocker.type === "skill_gap"));
  assert.ok(snapshot.careerRisks.every(({ affectsCurrentScore }) => affectsCurrentScore === false));
});

test("first priority prefers an actionable skill gap over company difficulty", () => {
  const snapshot = create(profileWith({
    companyType: "MAANG",
    skills: { dsa: "Beginner", os: "Beginner", networks: "Beginner" },
    resumeText: null
  }), "blocker-priority");

  assert.equal(snapshot.priority.sourceType, "score_blocker");
  assert.ok(snapshot.scoreBlockers.some(({ id }) => id === snapshot.priority.sourceId));
  assert.equal(snapshot.priority.facts.targetInsightType, "skill_gap");
  assert.equal(snapshot.priority.expectedImpact.readinessScore, true);
  assert.equal(snapshot.priority.expectedImpact.employabilityConfidence, true);
});

test("first priority can select a career risk when resume gaps dominate", () => {
  const snapshot = create(profileWith({
    ...profiles.fullStack,
    skills: {
      dsa: "Advanced",
      dbms: "Advanced",
      os: "Advanced",
      networks: "Advanced",
      aptitude: "Advanced",
      communication: "Strong"
    },
    companyType: "Startup"
  }), "risk-priority");

  assert.ok(snapshot.careerRisks.length > 0);
  if (snapshot.scoreBlockers.length === 0) {
    assert.equal(snapshot.priority.sourceType, "career_risk");
    assert.ok(snapshot.careerRisks.some(({ id }) => id === snapshot.priority.sourceId));
    assert.equal(snapshot.priority.expectedImpact.readinessScore, false);
  } else {
    assert.equal(snapshot.priority.sourceType, "score_blocker");
  }
  assert.equal(snapshot.priority.expectedImpact.employabilityConfidence, true);
  assert.ok(
    snapshot.priority.internalTrace.evidenceIds.length > 0
    || snapshot.priority.internalTrace.contributionIds.length > 0
  );
});

test("deterministic language prefers actionable deployment guidance for production gaps", async () => {
  const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
  const snapshot = create(profiles.fullStack, "actionable-language");
  const language = await generateAnalysisLanguage(snapshot);
  assert.match(language.output.priority.text, /\b(?:deploy|cloud|internship|practice|publish|raising|Focus first)\b/i);
  assert.doesNotMatch(language.output.priority.text, /highest-impact gap identified in the analysis/i);
  assert.doesNotMatch(JSON.stringify(language.output), /End To End Delivery|Service Engineering/i);
});
