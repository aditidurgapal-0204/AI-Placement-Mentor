"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  generateAnalysisLanguage,
  isPassUngroundedGeminiEnabled
} = require("../../services/placementAnalysis/analysisLanguageService");
const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { profiles } = require("./fixtures/profileFixtures");

test("pass-ungrounded flag defaults to ON when env is missing", () => {
  assert.equal(isPassUngroundedGeminiEnabled({}), true);
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "" }), true);
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "true" }), true);
});

test("pass-ungrounded flag is OFF only for explicit falsy values", () => {
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "false" }), false);
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "0" }), false);
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "off" }), false);
  assert.equal(isPassUngroundedGeminiEnabled({ LANGUAGE_PASS_UNGROUNDED_GEMINI: "no" }), false);
});

test("when passUngroundedGemini is true, grounding failure still returns Gemini output", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "flag-test",
    requestId: "flag-test",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  // Align insight IDs with whatever the snapshot actually produced for schema pass,
  // then force an unapproved claim so grounding fails.
  const dtoLanguage = await generateAnalysisLanguage(snapshot, async () => {
    const strengths = snapshot.strengths.map((item) => ({
      insightId: item.id,
      text: "A grounded strength sentence for the selected role."
    }));
    const scoreBlockers = snapshot.scoreBlockers.map((item) => ({
      insightId: item.id,
      text: "A grounded blocker sentence for the selected role."
    }));
    const careerRisks = snapshot.careerRisks.map((item) => ({
      insightId: item.id,
      text: "A grounded career risk sentence for the selected role."
    }));
    return JSON.stringify({
      analysisId: snapshot.metadata.id,
      diagnosis: [
        "Your readiness score of 999 indicates an impossible invented jump.",
        strengths[0]?.text || "You have a usable foundation.",
        scoreBlockers[0]?.text || "One gap remains.",
        "Focus first on closing that gap with weekly practice.",
        "With available preparation time, improvement is realistic."
      ].join(" "),
      strengths,
      scoreBlockers,
      careerRisks,
      priority: {
        insightId: snapshot.priority.id,
        text: "Focus first on closing that gap with weekly practice."
      }
    });
  }, { passUngroundedGemini: true });

  assert.equal(dtoLanguage.source, "gemini");
  assert.equal(dtoLanguage.groundingBypassed, true);
  assert.ok(Array.isArray(dtoLanguage.groundingErrors) && dtoLanguage.groundingErrors.length > 0);
  assert.match(dtoLanguage.output.diagnosis, /999/);
});

test("when passUngroundedGemini is false, grounding failure uses deterministic fallback", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "flag-test-off",
    requestId: "flag-test-off",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  const language = await generateAnalysisLanguage(snapshot, async () => {
    const strengths = snapshot.strengths.map((item) => ({
      insightId: item.id,
      text: "A grounded strength sentence for the selected role."
    }));
    const scoreBlockers = snapshot.scoreBlockers.map((item) => ({
      insightId: item.id,
      text: "A grounded blocker sentence for the selected role."
    }));
    const careerRisks = snapshot.careerRisks.map((item) => ({
      insightId: item.id,
      text: "A grounded career risk sentence for the selected role."
    }));
    return JSON.stringify({
      analysisId: snapshot.metadata.id,
      diagnosis: [
        "Your readiness score of 999 indicates an impossible invented jump.",
        strengths[0]?.text || "You have a usable foundation.",
        scoreBlockers[0]?.text || "One gap remains.",
        "Focus first on closing that gap with weekly practice.",
        "With available preparation time, improvement is realistic."
      ].join(" "),
      strengths,
      scoreBlockers,
      careerRisks,
      priority: {
        insightId: snapshot.priority.id,
        text: "Focus first on closing that gap with weekly practice."
      }
    });
  }, { passUngroundedGemini: false });

  assert.equal(language.source, "deterministic_fallback");
  assert.equal(language.groundingBypassed, false);
  assert.doesNotMatch(language.output.diagnosis, /999/);
});

test("API or parse failures still fall back even when pass-ungrounded is enabled", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "flag-test-error",
    requestId: "flag-test-error",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  const language = await generateAnalysisLanguage(
    snapshot,
    async () => {
      throw new Error("Gemini unavailable");
    },
    { passUngroundedGemini: true }
  );
  assert.equal(language.source, "deterministic_fallback");
});
