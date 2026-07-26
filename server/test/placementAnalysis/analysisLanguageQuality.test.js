"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { findForbiddenPublicKeys } = require("../../contracts/publicAnalysisV2");
const { createPublicAnalysisV2 } = require("../../services/placementAnalysis/publicAnalysisV2Adapter");
const { profiles, profileWith, representativeFullStack } = require("./fixtures/profileFixtures");

const banned = /verified evidence|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration|score contribution|capability family|reasoning dimension|confidence aggregation/i;
const action = /\b(?:build|create|complete|improve|publish|gain|practice|review|strengthen|focus|use|bring)\b/i;

const scenarios = {
  fullStack: profiles.fullStack,
  representativeFullStack,
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
    assert.ok(sentences >= 3 && sentences <= 7, output.diagnosis);
    assert.ok(words >= 45 && words <= 190, output.diagnosis);
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

test("representative moderate full-stack profile keeps only earned strengths while retaining project evidence in diagnosis context", async () => {
  const snapshot = createMentorAnalysisSnapshot(representativeFullStack, {
    analysisId: "representative-full-stack", requestId: "representative-full-stack"
  });
  const language = await generateAnalysisLanguage(snapshot);
  const publicAnalysis = createPublicAnalysisV2(snapshot, language);

  assert.ok(snapshot.readiness.score < 75);
  assert.ok(snapshot.strengths.length <= 3);
  assert.equal(language.dto.strengths.length, snapshot.strengths.length);
  assert.equal(language.output.strengths.length, snapshot.strengths.length);
  assert.equal(publicAnalysis.strengths.length, snapshot.strengths.length);
  assert.ok(snapshot.strengths.every(({ type }) => [
    "project_strength", "academic_strength", "leadership_strength", "profile_skill_strength"
  ].includes(type)));
  assert.ok(snapshot.scoreDrivers.some((driver) =>
    driver.facts.supportingFacts.projectExamples.some(({ name }) => name === "Campus Navigation Application")
  ));
  assert.equal(publicAnalysis.readiness.score, snapshot.readiness.score);
  assert.deepEqual(findForbiddenPublicKeys(publicAnalysis), []);
});
