const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profiles } = require("./fixtures/profileFixtures");

const snapshotFor = (profile, suffix) => createMentorAnalysisSnapshot(profile, {
  analysisId: `analysis-${suffix}`,
  requestId: `request-${suffix}`,
  createdAt: "2026-07-20T00:00:00.000Z"
});

test("mentor strengths group verified evidence into generalized conclusions", () => {
  const fullStack = snapshotFor(profiles.fullStack, "full-stack");
  const machineLearning = snapshotFor(profiles.machineLearning, "ml");

  assert.ok(fullStack.strengths.some(({ conclusion }) => /complete applications across the user interface, server, and data layers/i.test(conclusion)));
  assert.ok(machineLearning.strengths.some(({ conclusion }) => /machine-learning techniques in practical projects/i.test(conclusion)));
  assert.equal(fullStack.strengths.some(({ conclusion }) => /react|postgresql|commerce platform/i.test(conclusion)), false);
  assert.equal(machineLearning.strengths.some(({ conclusion }) => /collaborative filtering|recommendation engine/i.test(conclusion)), false);
});

test("score drivers trace only to positive deterministic contributions", () => {
  const snapshot = snapshotFor(profiles.backend, "drivers");
  const ledgerById = new Map(snapshot.internalTrace.scoreLedger.contributions.map((item) => [item.id, item]));

  assert.ok(snapshot.scoreDrivers.length > 0);
  snapshot.scoreDrivers.forEach((driver) => {
    assert.ok(driver.contributionIds.length > 0);
    assert.ok(driver.contributionIds.every((id) => ledgerById.get(id)?.sign === "positive"));
    assert.ok(driver.internalTrace.contributionIds.every((id) => ledgerById.has(id)));
    assert.ok(driver.scoreEffect > 0);
  });
});

test("career risks are non-scoring and trace to verified evidence-status IDs", () => {
  const snapshot = snapshotFor(profiles.fullStack, "risks");
  const evidenceById = new Map(snapshot.internalTrace.canonicalEvidence.evidence.map((item) => [item.id, item]));

  assert.ok(snapshot.careerRisks.length > 0);
  snapshot.careerRisks.forEach((risk) => {
    assert.equal(risk.affectsCurrentScore, false);
    assert.equal(risk.scoreEffect, 0);
    assert.deepEqual(risk.contributionIds, []);
    assert.ok(risk.internalTrace.evidenceIds.length > 0);
    assert.ok(risk.internalTrace.evidenceIds.every((id) => evidenceById.has(id)));
  });
});

test("no-resume reasoning does not create resume-absence career risks", () => {
  const snapshot = snapshotFor(profiles.noResume, "no-resume");
  assert.equal(snapshot.context.resumeProvided, false);
  assert.equal(snapshot.careerRisks.some(({ type }) => [
    "professional_exposure", "portfolio_verifiability", "technical_evidence_depth", "production_readiness"
  ].includes(type)), false);
  assert.ok(snapshot.careerRisks.every(({ internalTrace }) => internalTrace.evidenceIds.length > 0));
});

test("every mentor conclusion has a resolvable internal trace", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    const snapshot = snapshotFor(profile, name);
    const evidenceIds = new Set(snapshot.internalTrace.canonicalEvidence.evidence.map(({ id }) => id));
    const contributionIds = new Set(snapshot.internalTrace.scoreLedger.contributions.map(({ id }) => id));
    const conclusions = [...snapshot.strengths, ...snapshot.scoreDrivers, ...snapshot.scoreBlockers, ...snapshot.careerRisks, snapshot.priority];

    conclusions.forEach((conclusion) => {
      const internalTrace = snapshot.internalTrace.insightTrace[conclusion.id];
      assert.ok(internalTrace, `${name}:${conclusion.id} trace is missing`);
      assert.ok(internalTrace.evidenceIds.length + internalTrace.contributionIds.length > 0, `${name}:${conclusion.id} is ungrounded`);
      assert.ok(internalTrace.evidenceIds.every((id) => evidenceIds.has(id)), `${name}:${conclusion.id} has unknown evidence`);
      assert.ok(internalTrace.contributionIds.every((id) => contributionIds.has(id)), `${name}:${conclusion.id} has unknown contribution`);
    });
  }
});

test("mentor insight confidence is derived from supporting evidence", () => {
  const snapshot = snapshotFor(profiles.leadershipHeavy, "confidence");
  snapshot.strengths.forEach(({ confidence }) => {
    assert.ok(confidence.value >= 0 && confidence.value <= 1);
    assert.match(confidence.basis, /evidence|contribution/);
  });
});

module.exports = { snapshotFor };
