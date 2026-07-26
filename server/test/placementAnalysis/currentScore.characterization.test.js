const assert = require("node:assert/strict");
const test = require("node:test");

const { computeReadiness } = require("../../services/readinessEngine");
const { profiles } = require("./fixtures/profileFixtures");

const expectedScores = Object.freeze({
  fullStack: 44,
  machineLearning: 35,
  backend: 41,
  frontend: 38,
  unfamiliar: 38,
  sparse: 29,
  leadershipHeavy: 35,
  noResume: 57
});

test("current readiness scores remain deterministic across representative profiles", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    const first = computeReadiness(profile);
    const second = computeReadiness(profile);
    assert.equal(first.readinessScore, expectedScores[name], `${name} score changed`);
    assert.equal(second.readinessScore, expectedScores[name], `${name} repeated score changed`);
    assert.deepEqual(second.scoreBreakdown, first.scoreBreakdown, `${name} contribution ledger changed between runs`);
  }
});

test("current score contribution sources and final bounding remain stable", () => {
  const result = computeReadiness(profiles.fullStack);
  const contributionSources = result.scoreBreakdown.contributions.map(({ source }) => source);

  assert.deepEqual(contributionSources, [
    "profile.dsa", "profile.dbms", "profile.os", "profile.networks",
    "resume.projects", "resume.internship", "resume.portfolio",
    "profile.aptitude", "profile.communication", "resume.certifications",
    "resume.leadership", "profile.cgpa", "profile.timeline", "company.targetDifficulty"
  ]);
  assert.equal(result.scoreBreakdown.score, result.readinessScore);
  assert.ok(result.readinessScore >= 0 && result.readinessScore <= 100);
});

test("no-resume scoring retains the current numeric baseline without resume-only conclusions", () => {
  const result = computeReadiness(profiles.noResume);
  assert.equal(result.readinessScore, 57);
  assert.equal(result.scoreBreakdown.scoreBasis, "profile_only");
  assert.equal(result.scoreBreakdown.availableMaximum, 51);
  assert.equal(result.extractedMetrics.resumeEvaluated, false);
  assert.deepEqual(result.resumeWeaknesses, []);
});
