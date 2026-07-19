"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { findForbiddenPublicKeys } = require("../../contracts/publicAnalysisV2");
const { profiles, profileWith } = require("./fixtures/profileFixtures");

const banned = /verified evidence|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration|score contribution|capability family|reasoning dimension|confidence aggregation/i;
const action = /\b(?:build|create|complete|improve|publish|gain|practice|review|strengthen|focus|use|bring)\b/i;

const scenarios = {
  fullStack: profiles.fullStack,
  machineLearning: profiles.machineLearning,
  sparse: profiles.sparse,
  noResume: profiles.noResume,
  leadershipHeavy: profiles.leadershipHeavy,
  professionalExperience: profileWith({
    targetRole: "Backend Developer",
    resumeText: "EXPERIENCE\nSoftware Engineering Intern\nBuilt and tested REST services with a product team.\nPROJECTS\nService Platform\nBuilt an API with authentication and database integration.\nEDUCATION\nBachelor of Engineering"
  }),
  noProfessionalExperience: profiles.backend
};

for (const [name, profile] of Object.entries(scenarios)) {
  test(`${name} fallback is concise, student-facing, trace-safe, and actionable`, async () => {
    const snapshot = createMentorAnalysisSnapshot(profile, {
      analysisId: `quality-${name}`, requestId: `quality-${name}`, createdAt: "2026-07-20T00:00:00.000Z"
    });
    const expectedScore = snapshot.readiness.score;
    const result = await generateAnalysisLanguage(snapshot);
    const output = result.output;
    const publicText = JSON.stringify(output);
    const sentences = (output.diagnosis.match(/[.!?](?:\s|$)/g) || []).length;
    const words = output.diagnosis.trim().split(/\s+/).length;

    assert.equal(result.source, "deterministic_fallback");
    assert.equal(snapshot.readiness.score, expectedScore);
    assert.ok(sentences >= 3 && sentences <= 5, output.diagnosis);
    assert.ok(words >= 45 && words <= 120, output.diagnosis);
    assert.doesNotMatch(publicText, banned);
    assert.match(output.priority.text, action);
    assert.ok(output.strengths.length > 0);
    assert.match(publicText, new RegExp(profile.targetRole.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    [...output.scoreBlockers, ...output.careerRisks].forEach(({ text }) => assert.match(text, action));
    assert.equal(new Set(output.strengths.map(({ text }) => text.toLowerCase())).size, output.strengths.length);
    assert.deepEqual(findForbiddenPublicKeys(output), []);
  });
}

test("Gemini failure returns the same useful deterministic language", async () => {
  const snapshot = createMentorAnalysisSnapshot(profiles.fullStack, {
    analysisId: "quality-gemini-failure", requestId: "quality-gemini-failure"
  });
  const direct = await generateAnalysisLanguage(snapshot);
  const failed = await generateAnalysisLanguage(snapshot, async () => { throw new Error("Gemini unavailable"); });
  assert.equal(failed.source, "deterministic_fallback");
  assert.deepEqual(failed.output, direct.output);
  assert.match(failed.output.priority.text, action);
});
