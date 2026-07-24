"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { computeReadiness } = require("../../services/readinessEngine");
const { analyzePlacementProfileV2 } = require("../../services/placementAnalysis/productionAnalysisService");
const { findForbiddenPublicKeys } = require("../../contracts/publicAnalysisV2");
const { profiles } = require("./fixtures/profileFixtures");

const legacyResult = (score) => ({
  readinessScore: score, diagnosis: "Legacy diagnosis", strengths: ["Legacy strength"],
  strengthFacts: [], weaknesses: ["Legacy weakness"]
});

const dtoFromPrompt = (prompt) => JSON.parse(prompt.split("MENTOR_ANALYSIS\n")[1]);
const groundedDiagnosis = "You have a useful base for your selected role and your strongest work already supports your preparation. The clearest strength is the practical capability shown in your current profile. One important gap is still limiting how ready you are for placement rounds. Address the first priority through regular focused work, while continuing to improve the strengths that already support your application.";
const groundedOutput = (dto) => ({
  analysisId: dto.analysisId,
  diagnosis: groundedDiagnosis,
  strengths: dto.strengths.map(({ id, conclusion }) => ({ insightId: id, text: conclusion })),
  scoreBlockers: dto.scoreBlockers.map(({ id, conclusion }) => ({ insightId: id, text: conclusion })),
  careerRisks: dto.careerRisks.map(({ id, conclusion }) => ({ insightId: id, text: conclusion })),
  priority: { insightId: dto.priority.id, text: dto.priority.objective }
});

const run = (profile, overrides = {}) => {
  let readinessCalls = 0;
  const dependencies = {
    computeReadiness(value) { readinessCalls += 1; return computeReadiness(value); },
    analyzeLegacy: async (_value, { engineFacts }) => legacyResult(engineFacts.readinessScore),
    generateLanguage: async (prompt) => groundedOutput(dtoFromPrompt(prompt)),
    ...overrides
  };
  return {
    getReadinessCalls: () => readinessCalls,
    promise: analyzePlacementProfileV2(profile, {
      requestId: "request-integration", analysisId: "analysis-integration",
      createdAt: "2026-07-20T00:00:00.000Z", languageTimeoutMs: 25, dependencies
    })
  };
};

test("production flow returns unchanged legacy analysis beside explicit public V2", async () => {
  const execution = run(profiles.fullStack);
  const result = await execution.promise;
  assert.deepEqual(Object.keys(result).sort(), ["analysis", "analysisV2"]);
  assert.deepEqual(Object.keys(result.analysis).sort(), ["diagnosis", "readinessScore", "strengthFacts", "strengths", "weaknesses"]);
  assert.equal(result.analysisV2.contractVersion, "2.0");
  assert.equal(result.analysisV2.requestId, "request-integration");
  assert.equal(execution.getReadinessCalls(), 1);
});

test("valid grounded language reaches public V2 with Gemini source", async () => {
  const { analysisV2 } = await run(profiles.backend).promise;
  assert.equal(analysisV2.languageSource, "gemini");
});

for (const [name, generateLanguage] of [
  ["Gemini failure", async () => { throw new Error("unavailable"); }],
  ["malformed Gemini output", async () => "not json"],
  ["unknown IDs", async (prompt) => ({ ...groundedOutput(dtoFromPrompt(prompt)), strengths: [{ insightId: "unknown", text: "Unknown" }] })],
  ["missing IDs", async (prompt) => ({ ...groundedOutput(dtoFromPrompt(prompt)), strengths: [] })],
  ["duplicate IDs", async (prompt) => { const output = groundedOutput(dtoFromPrompt(prompt)); output.strengths.push(output.strengths[0]); return output; }],
  ["reordered IDs", async (prompt) => { const output = groundedOutput(dtoFromPrompt(prompt)); output.careerRisks.reverse(); return output; }],
  ["invented numeric claim", async (prompt) => { const output = groundedOutput(dtoFromPrompt(prompt)); output.diagnosis += " Improvement is 997 points."; return output; }],
  ["career-risk score causality", async (prompt) => { const output = groundedOutput(dtoFromPrompt(prompt)); if (output.careerRisks[0]) output.careerRisks[0].text = "This lowers the readiness score."; return output; }]
]) {
  test(`${name} returns a valid deterministic V2 fallback`, async () => {
    const { analysisV2 } = await run(profiles.fullStack, { generateLanguage }).promise;
    assert.equal(analysisV2.languageSource, "deterministic_fallback");
    assert.ok(analysisV2.diagnosis);
  });
}

test("Gemini timeout returns a valid deterministic V2 fallback", async () => {
  const { analysisV2 } = await run(profiles.fullStack, { generateLanguage: () => new Promise(() => {}) }).promise;
  assert.equal(analysisV2.languageSource, "deterministic_fallback");
});

test("public V2 recursively excludes internal evidence, traces, score effects, and contribution IDs", async () => {
  const { analysisV2 } = await run(profiles.machineLearning).promise;
  assert.deepEqual(findForbiddenPublicKeys(analysisV2), []);
  const serialized = JSON.stringify(analysisV2);
  for (const key of ["internalTrace", "canonicalEvidence", "scoreLedger", "contributionIds", "scoreEffect", "technologies", "methods"]) {
    assert.equal(serialized.includes(`\"${key}\"`), false);
  }
});

test("runtime Gemini invocation receives only the presentation-safe DTO", async () => {
  let capturedPrompt;
  await run(profiles.machineLearning, {
    generateLanguage: async (prompt) => {
      capturedPrompt = prompt;
      return groundedOutput(dtoFromPrompt(prompt));
    }
  }).promise;
  for (const key of ["internalTrace", "canonicalEvidence", "scoreLedger", "evidenceIds", "contributionIds", "scoreEffect", "methods", "resumeText"]) {
    assert.equal(capturedPrompt.includes(`\"${key}\"`), false, key);
  }
  assert.ok(capturedPrompt.includes('"projectExamples"'));
  assert.ok(capturedPrompt.includes('"technologies"'));
});

test("career-risk and score-blocker collections remain distinct in public V2", async () => {
  const { analysisV2 } = await run(profiles.fullStack).promise;
  const blockerIds = new Set(analysisV2.scoreBlockers.map(({ id }) => id));
  assert.ok(analysisV2.careerRisks.every(({ id }) => !blockerIds.has(id)));
});

test("Phase 0 readiness values remain unchanged in both response versions", async () => {
  const expected = { fullStack: 49, machineLearning: 53, backend: 47, frontend: 46, unfamiliar: 46, sparse: 41, leadershipHeavy: 46, noResume: 41 };
  for (const [name, score] of Object.entries(expected)) {
    const result = await run(profiles[name]).promise;
    assert.equal(result.analysis.readinessScore, score, name);
    assert.equal(result.analysisV2.readiness.score, score, name);
  }
});

test("no-resume production analysis remains valid", async () => {
  const { analysisV2 } = await run(profiles.noResume).promise;
  assert.equal(analysisV2.context.resumeProvided, false);
  assert.ok(analysisV2.diagnosis);
});

test("resume replacement does not retain the previous analysis context or conclusions", async () => {
  const first = await run(profiles.machineLearning).promise;
  const second = await run(profiles.backend).promise;
  assert.equal(second.analysisV2.context.targetRole, profiles.backend.targetRole);
  assert.notDeepEqual(second.analysisV2.strengths, first.analysisV2.strengths);
});

test("concurrent requests retain independent IDs, contexts, and immutable results", async () => {
  const first = analyzePlacementProfileV2(profiles.frontend, {
    requestId: "older", analysisId: "analysis-older", dependencies: {
      analyzeLegacy: async (_profile, { engineFacts }) => legacyResult(engineFacts.readinessScore),
      generateLanguage: async (prompt) => { await new Promise((resolve) => setTimeout(resolve, 15)); return groundedOutput(dtoFromPrompt(prompt)); }
    }
  });
  const second = analyzePlacementProfileV2(profiles.backend, {
    requestId: "newer", analysisId: "analysis-newer", dependencies: {
      analyzeLegacy: async (_profile, { engineFacts }) => legacyResult(engineFacts.readinessScore),
      generateLanguage: async (prompt) => groundedOutput(dtoFromPrompt(prompt))
    }
  });
  const newer = await second;
  const older = await first;
  assert.equal(newer.analysisV2.requestId, "newer");
  assert.equal(older.analysisV2.requestId, "older");
  assert.equal(newer.analysisV2.context.targetRole, profiles.backend.targetRole);
  assert.equal(older.analysisV2.context.targetRole, profiles.frontend.targetRole);
});
