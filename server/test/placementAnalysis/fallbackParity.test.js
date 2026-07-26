"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { validateGeminiGrounding } = require("../../services/placementAnalysis/geminiGroundingValidator");
const { profiles } = require("./fixtures/profileFixtures");

const buildSnapshot = () => createMentorAnalysisSnapshot(profiles.machineLearning, {
  analysisId: "analysis-fallback", requestId: "request-fallback", createdAt: "2026-07-20T00:00:00.000Z"
});

const groundedDiagnosis = "You have a useful base for your selected role and your strongest work already supports your preparation. The clearest strength is the practical capability shown in your current profile. One important gap is still limiting how ready you are for placement rounds. Address the first priority through regular focused work, while continuing to improve the strengths that already support your application.";
const groundedInsight = ({ id, type }) => `The ${String(type).replace(/_/g, " ")} insight (${id}) is based on the supplied profile evidence.`;

test("deterministic fallback preserves every backend-selected insight and its ordering", async () => {
  const result = await generateAnalysisLanguage(buildSnapshot());
  assert.equal(result.source, "deterministic_fallback");
  assert.deepEqual(result.output.strengths.map(({ insightId }) => insightId), result.dto.strengths.map(({ id }) => id));
  assert.deepEqual(result.output.scoreBlockers.map(({ insightId }) => insightId), result.dto.scoreBlockers.map(({ id }) => id));
  assert.deepEqual(result.output.careerRisks.map(({ insightId }) => insightId), result.dto.careerRisks.map(({ id }) => id));
  assert.deepEqual(validateGeminiGrounding(result.output, result.dto), { valid: true, errors: [] });
});

test("invalid Gemini output falls back to the same DTO without changing backend conclusions", async () => {
  const result = await generateAnalysisLanguage(buildSnapshot(), async () => ({
    analysisId: "invented-analysis", diagnosis: "Invented", strengths: [], scoreBlockers: [], careerRisks: [],
    priority: { insightId: "invented", text: "Invented" }
  }));
  assert.equal(result.source, "deterministic_fallback");
  assert.ok(result.groundingErrors.length > 0);
  assert.deepEqual(result.output.strengths.map(({ insightId }) => insightId), result.dto.strengths.map(({ id }) => id));
});

test("valid generated language is accepted without allowing the model to alter selection", async () => {
  const result = await generateAnalysisLanguage(buildSnapshot(), async ({ dto }) => ({
    analysisId: dto.analysisId,
    diagnosis: groundedDiagnosis,
    strengths: dto.strengths.map((item) => ({ insightId: item.id, text: groundedInsight(item) })),
    scoreBlockers: dto.scoreBlockers.map((item) => ({ insightId: item.id, text: groundedInsight(item) })),
    careerRisks: dto.careerRisks.map((item) => ({ insightId: item.id, text: groundedInsight(item) })),
    priority: { insightId: dto.priority.id, text: "Focus on improving the most important supplied gap." }
  }));
  assert.equal(result.source, "gemini");
});
