"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { createPresentationSafeGeminiDto } = require("../../services/placementAnalysis/analysisLanguageService");
const { validatePresentationSafeGeminiInput, findForbiddenKeys } = require("../../contracts/presentationSafeGemini.v1");
const { profiles } = require("./fixtures/profileFixtures");

const snapshot = () => createMentorAnalysisSnapshot(profiles.fullStack, {
  analysisId: "analysis-language", requestId: "request-language", createdAt: "2026-07-20T00:00:00.000Z"
});

test("presentation projection is valid and contains only explicitly approved top-level fields", () => {
  const dto = createPresentationSafeGeminiDto(snapshot());
  assert.deepEqual(Object.keys(dto), [
    "version", "analysisId", "context", "readiness", "strengths", "scoreBlockers", "careerRisks", "priority", "diagnosisContext"
  ]);
  assert.ok(dto.strengths.some(({ evidence }) => evidence.projectExamples.length > 0));
  assert.deepEqual(validatePresentationSafeGeminiInput(dto), { valid: true, errors: [] });
  assert.deepEqual(findForbiddenKeys(dto), []);
});

test("allow-list projection does not leak internal traces or later-added snapshot fields", () => {
  const internal = snapshot();
  const extended = {
    ...internal,
    secretFutureField: "must not escape",
    context: { ...internal.context, email: "private@example.test", futureContext: "private" },
    strengths: internal.strengths.map((item) => ({ ...item, rawEvidence: "private", futureInsight: "private" }))
  };
  const dto = createPresentationSafeGeminiDto(extended);
  const serialized = JSON.stringify(dto);
  assert.equal(serialized.includes("secretFutureField"), false);
  assert.equal(serialized.includes("private@example.test"), false);
  assert.equal(serialized.includes("futureContext"), false);
  assert.equal(serialized.includes("rawEvidence"), false);
  assert.equal(serialized.includes("internalTrace"), false);
  assert.equal(serialized.includes('"confidence":'), false);
  assert.equal(serialized.includes('"scoreEffect":'), false);
  assert.equal(serialized.includes('"contributionIds":'), false);
});

test("projection preserves semantic ordering while excluding score drivers from language input", () => {
  const internal = snapshot();
  const dto = createPresentationSafeGeminiDto(internal);
  assert.deepEqual(dto.strengths.map(({ id }) => id), internal.strengths.map(({ id }) => id));
  assert.deepEqual(dto.scoreBlockers.map(({ id }) => id), internal.scoreBlockers.map(({ id }) => id));
  assert.equal(Object.hasOwn(dto, "scoreDrivers"), false);
  assert.ok(dto.careerRisks.every(({ affectsCurrentScore }) => affectsCurrentScore === false));
});
