"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { validateMentorAnalysisV2 } = require("../../contracts/mentorAnalysis.v2");
const { validatePresentationSafeGeminiInput } = require("../../contracts/presentationSafeGemini.v1");
const { profiles } = require("./fixtures/profileFixtures");

const options = {
  analysisId: "analysis-snapshot",
  requestId: "request-snapshot",
  createdAt: "2026-07-20T00:00:00.000Z"
};

test("orchestrator creates a valid immutable version 2 internal snapshot", () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.machineLearning, options);
  assert.deepEqual(validateMentorAnalysisV2(snapshot), { valid: true, errors: [] });
  assert.equal(snapshot.metadata.schemaVersion, "2.0");
  assert.equal(snapshot.metadata.modelVersions.scoring, "legacy-readiness-1.0");
  assert.equal(snapshot.metadata.modelVersions.language, "not_rendered");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.internalTrace.canonicalEvidence), true);
  assert.throws(() => { snapshot.readiness.score = 0; }, TypeError);
});

test("snapshot creation is deterministic when identity and time are injected", () => {
  const first = createMentorAnalysisSnapshot(profiles.backend, options);
  const second = createMentorAnalysisSnapshot(profiles.backend, options);
  assert.deepEqual(second, first);
});

test("internal trace references are rejected by the presentation-safe DTO contract", () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, options);
  const attemptedPublicDto = {
    version: "1.0",
    analysisId: snapshot.metadata.id,
    context: snapshot.context,
    readiness: { ...snapshot.readiness, meaning: snapshot.readiness.explanation },
    strengths: snapshot.strengths,
    scoreBlockers: snapshot.scoreBlockers,
    careerRisks: snapshot.careerRisks,
    priority: snapshot.priority,
    internalTrace: snapshot.internalTrace
  };
  const validation = validatePresentationSafeGeminiInput(attemptedPublicDto);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /evidenceIds|contributionIds/.test(error)));
});

test("orchestrator is not integrated into the legacy API response", () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, options);
  assert.ok(snapshot.internalTrace);
  const legacyPublicKeys = ["readinessScore", "diagnosis", "strengths", "strengthFacts", "weaknesses"];
  assert.equal(legacyPublicKeys.includes("internalTrace"), false);
  assert.equal(legacyPublicKeys.includes("analysisV2"), false);
});
