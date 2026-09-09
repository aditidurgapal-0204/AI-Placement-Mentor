"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profiles } = require("./fixtures/profileFixtures");

function ungroundedGenerator(snapshot) {
  return async () => JSON.stringify({
    analysisId: snapshot.metadata.id,
    diagnosis: [
      "Your readiness score of 999 indicates an impossible invented jump.",
      "You have a usable foundation for the selected role.",
      "One evidence gap remains in the profile.",
      "Focus first on closing that gap with weekly practice.",
      "With available preparation time, improvement is realistic."
    ].join(" "),
    strengths: snapshot.strengths.map((item) => ({ insightId: item.id, text: "A grounded strength sentence for the selected role." })),
    scoreBlockers: snapshot.scoreBlockers.map((item) => ({ insightId: item.id, text: "A grounded blocker sentence for the selected role." })),
    careerRisks: snapshot.careerRisks.map((item) => ({ insightId: item.id, text: "A grounded career risk sentence for the selected role." })),
    priority: { insightId: snapshot.priority.id, text: "Focus first on closing that gap with weekly practice." }
  });
}

for (const options of [undefined, { passUngroundedGemini: true }, { passUngroundedGemini: false }]) {
  test(`grounding failure always uses deterministic fallback (${JSON.stringify(options)})`, async () => {
    const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
      analysisId: `grounding-required-${String(options?.passUngroundedGemini)}`,
      requestId: "grounding-required",
      createdAt: "2026-07-20T00:00:00.000Z"
    });
    const language = await generateAnalysisLanguage(snapshot, ungroundedGenerator(snapshot), options);

    assert.equal(language.source, "deterministic_fallback");
    assert.equal(language.groundingBypassed, undefined);
    assert.doesNotMatch(language.output.diagnosis, /999/);
  });
}

test("API failures use deterministic fallback", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "grounding-api-error",
    requestId: "grounding-api-error",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  const language = await generateAnalysisLanguage(snapshot, async () => {
    throw new Error("Gemini unavailable");
  });

  assert.equal(language.source, "deterministic_fallback");
  assert.equal(language.groundingBypassed, undefined);
});
