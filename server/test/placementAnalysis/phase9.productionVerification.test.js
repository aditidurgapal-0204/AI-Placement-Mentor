"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzePlacementProfileV2 } = require("../../services/placementAnalysis/productionAnalysisService");
const { groundingFailureCategory } = require("../../services/placementAnalysis/analysisLanguageService");
const { findForbiddenPublicKeys } = require("../../contracts/publicAnalysisV2");
const { profileWith, profiles } = require("./fixtures/profileFixtures");

const expected = {
  noResume: [57, "Progressing"], sparse: [29, "Developing"], fullStack: [44, "Developing"],
  machineLearning: [35, "Developing"], leadershipHeavy: [35, "Developing"],
  unfamiliar: [38, "Developing"], backend: [41, "Developing"], frontend: [38, "Developing"]
};

const run = (profile, id) => analyzePlacementProfileV2(profile, {
  requestId: `request-${id}`,
  analysisId: `analysis-${id}`,
  createdAt: "2026-07-20T00:00:00.000Z",
  dependencies: {
    analyzeLegacy: async (_profile, { engineFacts }) => ({
      readinessScore: engineFacts.readinessScore, diagnosis: "Legacy diagnosis",
      strengths: ["Legacy strength"], strengthFacts: [], weaknesses: ["Legacy weakness"]
    }),
    generateLanguage: async () => { throw new Error("simulated unavailable language service"); }
  }
});

for (const [name, [score, label]] of Object.entries(expected)) {
  test(`representative ${name} flow preserves complete V2 and legacy contracts`, async () => {
    const { analysis, analysisV2 } = await run(profiles[name], name);
    assert.equal(analysis.readinessScore, score);
    assert.equal(analysisV2.readiness.score, score);
    assert.equal(analysisV2.readiness.label, label);
    assert.equal(analysisV2.languageSource, "deterministic_fallback");
    assert.ok(analysisV2.diagnosis);
    assert.ok(analysisV2.firstPriority.text);
    assert.ok(Array.isArray(analysisV2.strengths));
    assert.ok(Array.isArray(analysisV2.scoreBlockers));
    assert.ok(Array.isArray(analysisV2.careerRisks));
    assert.ok(analysisV2.preparation.feasibility);
    assert.ok(analysisV2.preparation.improvementPotential);
    assert.deepEqual(findForbiddenPublicKeys(analysisV2), []);
  });
}

test("genuine negative score contribution remains bounded and becomes a score blocker", async () => {
  const profile = profileWith({ companyType: "MAANG", skills: { dsa: "Beginner", os: "Beginner" }, resumeText: null });
  const { analysis, analysisV2 } = await run(profile, "negative");
  assert.equal(analysis.readinessScore, analysisV2.readiness.score);
  assert.ok(analysisV2.readiness.score >= 0);
  assert.ok(analysisV2.scoreBlockers.length > 0);
  assert.ok(analysisV2.firstPriority.text);
});

test("career risks remain present without being converted into score blockers", async () => {
  const { analysisV2 } = await run(profiles.fullStack, "risk-only");
  const blockerIds = new Set(analysisV2.scoreBlockers.map(({ id }) => id));
  assert.ok(analysisV2.careerRisks.length > 0);
  assert.ok(analysisV2.careerRisks.every(({ id }) => !blockerIds.has(id)));
});

test("skip-then-upload and resume replacement use only the latest supplied profile", async () => {
  const skipped = await run(profiles.noResume, "skipped");
  const uploaded = await run(profiles.fullStack, "uploaded");
  const replacement = await run(profiles.machineLearning, "replacement");
  assert.equal(skipped.analysisV2.context.resumeProvided, false);
  assert.equal(uploaded.analysisV2.context.resumeProvided, true);
  assert.equal(replacement.analysisV2.context.targetRole, profiles.machineLearning.targetRole);
  assert.notDeepEqual(replacement.analysisV2.strengths, uploaded.analysisV2.strengths);
});

test("safe grounding diagnostics classify recoverable failure families without evidence", () => {
  assert.equal(groundingFailureCategory(["Gemini language generation timed out."]), "timeout");
  assert.equal(groundingFailureCategory(["Unexpected token in JSON"]), "malformed_output");
  assert.equal(groundingFailureCategory(["strengths insight IDs and ordering must match input"]), "insight_identity");
  assert.equal(groundingFailureCategory(["contains unapproved numeric claim 17"]), "unsupported_numeric_claim");
  assert.equal(groundingFailureCategory(["careerRisks[0] must not claim current score causality"]), "causality_violation");
  assert.equal(groundingFailureCategory(["network unavailable"]), "generator_unavailable");
});
