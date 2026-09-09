const assert = require("node:assert/strict");
const test = require("node:test");

const { computeReadiness } = require("../../services/readinessEngine");
const {
  SCORE_MODEL_VERSION,
  adaptScoreBreakdownToLedger
} = require("../../services/placementAnalysis/scoreLedgerAdapter");
const { profiles } = require("./fixtures/profileFixtures");
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

test("score ledger preserves contribution order, source, sign, and magnitude", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    const result = computeReadiness(profile);
    const original = result.scoreBreakdown.contributions;
    const adapted = result.scoreLedger.contributions;

    assert.equal(adapted.length, original.length, `${name} contribution count changed`);
    original.forEach((contribution, index) => {
      assert.equal(adapted[index].index, index, `${name} contribution order changed`);
      assert.equal(adapted[index].source, contribution.source, `${name} source changed`);
      assert.equal(adapted[index].points, contribution.points, `${name} magnitude changed`);
      assert.equal(adapted[index].sign,
        contribution.points > 0 ? "positive" : contribution.points < 0 ? "negative" : "neutral",
        `${name} sign changed`);
    });
  }
});

test("contribution identifiers are deterministic and unique within a ledger", () => {
  const first = computeReadiness(profiles.fullStack).scoreLedger;
  const second = computeReadiness(profiles.fullStack).scoreLedger;

  assert.deepEqual(second.contributions.map(({ id }) => id), first.contributions.map(({ id }) => id));
  assert.equal(new Set(first.contributions.map(({ id }) => id)).size, first.contributions.length);
  assert.ok(first.contributions.every(({ id }) => /^contribution-[a-f0-9]{16}$/.test(id)));
});

test("ledger contribution ID indexes match sign-specific references", () => {
  const ledger = adaptScoreBreakdownToLedger({
    score: 12,
    contributions: [
      { source: "positive", points: 15 },
      { source: "negative", points: -3 },
      { source: "neutral", points: 0 }
    ],
    positiveContributions: [{ source: "positive", points: 15 }],
    negativeContributions: [{ source: "negative", points: -3 }]
  });

  assert.deepEqual(ledger.positiveContributionIds, [ledger.contributions[0].id]);
  assert.deepEqual(ledger.negativeContributionIds, [ledger.contributions[1].id]);
  assert.deepEqual(ledger.neutralContributionIds, [ledger.contributions[2].id]);
});

test("ledger exposes score-model metadata without recalculating the bounded score", () => {
  const scoreBreakdown = {
    score: 100,
    contributions: [
      { source: "first", points: 80 },
      { source: "second", points: 35 }
    ]
  };
  const before = structuredClone(scoreBreakdown);
  const ledger = adaptScoreBreakdownToLedger(scoreBreakdown);

  assert.equal(ledger.modelVersion, SCORE_MODEL_VERSION);
  assert.equal(ledger.score, 100);
  assert.equal(ledger.rawTotal, 115);
  assert.deepEqual(ledger.boundingRule, { minimum: 0, maximum: 100, rounding: "nearest_integer" });
  assert.deepEqual(scoreBreakdown, before);
});

test("readiness engine exposes the ledger while preserving characterized scores", () => {
  const expectedScores = {
    fullStack: 44,
    machineLearning: 35,
    backend: 41,
    frontend: 38,
    unfamiliar: 38,
    sparse: 29,
    leadershipHeavy: 35,
    noResume: 57
  };

  Object.entries(profiles).forEach(([name, profile]) => {
    const result = computeReadiness(profile);
    assert.equal(result.readinessScore, expectedScores[name]);
    assert.equal(result.scoreBreakdown.score, expectedScores[name]);
    assert.equal(result.scoreLedger.score, expectedScores[name]);
    assert.equal(result.scoreLedger.rawTotal,
      round2(result.scoreBreakdown.contributions.reduce((total, { points }) => total + points, 0)));
  });
});

test("adapter rejects an incomplete score breakdown", () => {
  assert.throws(() => adaptScoreBreakdownToLedger(null), /ordered contributions/);
  assert.throws(() => adaptScoreBreakdownToLedger({ score: 10 }), /ordered contributions/);
});
