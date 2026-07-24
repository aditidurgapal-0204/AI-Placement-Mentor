const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profileWith } = require("./fixtures/profileFixtures");

const create = (timeline, id) => createMentorAnalysisSnapshot(profileWith({ timeline, resumeText: null }), {
  analysisId: `analysis-${id}`, requestId: `request-${id}`, createdAt: "2026-07-20T00:00:00.000Z"
});

test("preparation feasibility uses only verified preparation capacity and required improvement", () => {
  const strong = create({ preparationTimelineMonths: 6, dailyStudyHours: 4 }, "strong");
  const limited = create({ preparationTimelineMonths: 1, dailyStudyHours: 1 }, "limited");

  assert.equal(strong.preparation.feasibility, "strong");
  assert.equal(limited.preparation.feasibility, "limited");
  assert.deepEqual(strong.preparation.verifiedInputs, [
    "timelineMonths", "dailyStudyHours", "currentReadiness", "requiredImprovement"
  ]);
});

test("preparation assessment remains qualitative and traceable", () => {
  const snapshot = create({ preparationTimelineMonths: 4, dailyStudyHours: 2 }, "qualitative");
  assert.match(snapshot.preparation.improvementPotential, /^(limited|moderate|strong)_capacity_for_(focused|moderate|substantial)_improvement$/);
  assert.ok(snapshot.preparation.internalTrace.evidenceIds.length === 2);
  assert.equal(/guarantee|will be placed|placement assured/i.test(JSON.stringify(snapshot.preparation)), false);
});
