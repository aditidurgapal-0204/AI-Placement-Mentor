"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { createPublicAnalysisV2 } = require("../../services/placementAnalysis/publicAnalysisV2Adapter");
const { profiles } = require("./fixtures/profileFixtures");

test("public analysis V2 always emits a non-empty readiness explanation", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "explanation-test",
    requestId: "explanation-test",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  const language = await generateAnalysisLanguage(snapshot);
  const publicAnalysis = createPublicAnalysisV2(snapshot, language);

  assert.equal(typeof publicAnalysis.readiness.explanation, "string");
  assert.ok(publicAnalysis.readiness.explanation.trim().length > 20);
  assert.match(publicAnalysis.readiness.explanation, new RegExp(`${publicAnalysis.readiness.score}%`));
  assert.match(publicAnalysis.readiness.explanation, /readiness/i);
  assert.equal(publicAnalysis.readiness.labelKey, snapshot.readiness.labelKey);
});
