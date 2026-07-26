"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { analyzePlacementProfileV2 } = require("../../services/placementAnalysis/productionAnalysisService");
const { profileWith } = require("./fixtures/profileFixtures");

const weakProfile = profileWith({
  cgpa: 6.2,
  targetRole: "Backend Developer",
  resumeText: null,
  skills: {
    dsa: "Beginner",
    dbms: "Beginner",
    os: "Beginner",
    networks: "Beginner",
    aptitude: "Beginner",
    communication: "Beginner"
  }
});

const dtoFromPrompt = (prompt) => JSON.parse(prompt.split("MENTOR_ANALYSIS\n")[1]);
const languageFor = (prompt) => {
  const dto = dtoFromPrompt(prompt);
  return {
    analysisId: dto.analysisId,
    diagnosis: "Your current profile is at an early stage for the role you selected. Core interview subjects need more consistent preparation before you can rely on them in placement rounds. Focus first on the highest-impact gap and build one completed project as your foundation. Your available preparation time can support steady progress when you work on one priority at a time.",
    strengths: dto.strengths.map(({ id }) => ({ insightId: id, text: `The verified ${id} strength supports your selected role.` })),
    scoreBlockers: dto.scoreBlockers.map(({ id }) => ({ insightId: id, text: `The assessed ${id} gap currently needs focused work.` })),
    careerRisks: dto.careerRisks.map(({ id }) => ({ insightId: id, text: `The ${id} evidence gap is separate from the current readiness score.` })),
    priority: { insightId: dto.priority.id, text: "Focus on the highest-impact assessed gap first." }
  };
};

test("a weak profile receives no unearned strengths", () => {
  const snapshot = createMentorAnalysisSnapshot(weakProfile, {
    analysisId: "weak-analysis",
    requestId: "weak-request",
    createdAt: "2026-07-27T00:00:00.000Z"
  });
  assert.deepEqual(snapshot.strengths, []);
});

test("a self-assessed advanced skill can be a strength even when no resume is supplied", () => {
  const snapshot = createMentorAnalysisSnapshot(profileWith({
    resumeText: null,
    skills: { dsa: "Advanced" }
  }), {
    analysisId: "profile-skill-analysis",
    requestId: "profile-skill-request",
    createdAt: "2026-07-27T00:00:00.000Z"
  });
  assert.ok(snapshot.strengths.some(({ type }) => type === "profile_skill_strength"));
});

test("legacy and V2 outputs are projected from the same validated analysis", async () => {
  const result = await analyzePlacementProfileV2(weakProfile, {
    requestId: "legacy-consistency-request",
    analysisId: "legacy-consistency-analysis",
    dependencies: {
      extractResumeFacts: async () => ({ source: "not_applicable", version: "resume-facts-1.0:not-applicable", model: null, facts: null, warnings: [] }),
      generateLanguage: languageFor
    }
  });
  assert.deepEqual(result.analysis.strengths, result.analysisV2.strengths.map(({ text }) => text));
  assert.deepEqual(result.analysis.weaknesses, [
    ...result.analysisV2.scoreBlockers,
    ...result.analysisV2.careerRisks
  ].map(({ text }) => text));
  assert.deepEqual(result.analysisV2.strengths, []);
});
