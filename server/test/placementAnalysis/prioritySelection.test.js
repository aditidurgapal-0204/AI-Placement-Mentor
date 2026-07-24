const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profileWith, profiles } = require("./fixtures/profileFixtures");

const create = (profile, id) => createMentorAnalysisSnapshot(profile, {
  analysisId: `analysis-${id}`, requestId: `request-${id}`, createdAt: "2026-07-20T00:00:00.000Z"
});

test("negative score contributions become separate traceable score blockers", () => {
  const profile = profileWith({
    companyType: "MAANG",
    skills: { dsa: "Beginner", os: "Beginner" },
    resumeText: null
  });
  const snapshot = create(profile, "score-blocker");
  const ledgerById = new Map(snapshot.internalTrace.scoreLedger.contributions.map((item) => [item.id, item]));

  assert.ok(snapshot.scoreBlockers.length > 0);
  snapshot.scoreBlockers.forEach((blocker) => {
    assert.ok(blocker.scoreEffect < 0);
    assert.ok(blocker.contributionIds.every((id) => ledgerById.get(id)?.sign === "negative"));
  });
  assert.ok(snapshot.careerRisks.every(({ affectsCurrentScore }) => affectsCurrentScore === false));
});

test("first priority selects the strongest score blocker when one exists", () => {
  const snapshot = create(profileWith({
    companyType: "MAANG",
    skills: { dsa: "Beginner", os: "Beginner" },
    resumeText: null
  }), "blocker-priority");

  assert.equal(snapshot.priority.sourceType, "score_blocker");
  assert.ok(snapshot.scoreBlockers.some(({ id }) => id === snapshot.priority.sourceId));
  assert.equal(snapshot.priority.expectedImpact.readinessScore, true);
  assert.equal(snapshot.priority.expectedImpact.employabilityConfidence, true);
  assert.ok(snapshot.priority.internalTrace.contributionIds.length > 0);
});

test("first priority selects a career risk when there is no negative score contribution", () => {
  const snapshot = create(profiles.fullStack, "risk-priority");
  assert.equal(snapshot.scoreBlockers.length, 0);
  assert.equal(snapshot.priority.sourceType, "career_risk");
  assert.ok(snapshot.careerRisks.some(({ id }) => id === snapshot.priority.sourceId));
  assert.equal(snapshot.priority.expectedImpact.readinessScore, false);
  assert.equal(snapshot.priority.expectedImpact.employabilityConfidence, true);
  assert.ok(snapshot.priority.internalTrace.evidenceIds.length > 0);
});
