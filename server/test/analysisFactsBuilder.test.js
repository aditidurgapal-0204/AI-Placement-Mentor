const assert = require("node:assert/strict");
const test = require("node:test");
const { buildAnalysisFacts } = require("../services/readiness/analysisFactsBuilder");

const profileData = {
  cgpa: "8.4",
  skills: { dsa: "advanced", dbms: "beginner", os: "beginner", communication: "strong" },
  timeline: { preparationTimelineMonths: 6, dailyStudyHours: 5 }
};

const scoreBreakdown = {
  score: 45,
  contributions: [
    { source: "profile.dsa", points: 20 },
    { source: "profile.dbms", points: 0 },
    { source: "profile.os", points: 0 },
    { source: "profile.communication", points: 5 },
    { source: "profile.cgpa", points: 5 },
    { source: "profile.timeline", points: 10 },
    { source: "company.requiredSkills", points: -10 }
  ],
  positiveContributions: [
    { source: "profile.dsa", points: 20 },
    { source: "profile.communication", points: 5 },
    { source: "profile.cgpa", points: 5 },
    { source: "profile.timeline", points: 10 }
  ],
  negativeContributions: [{ source: "company.requiredSkills", points: -10 }]
};

test("no-resume analysis retains verified profile strengths and omits resume-only gaps", () => {
  const facts = buildAnalysisFacts({
    profileData,
    rankedCandidates: [],
    profileWeaknesses: ["Beginner-level Database Management Systems", "Beginner-level Operating Systems"],
    resumeWeaknesses: [],
    resumeFacts: { certifications: [], github: false },
    scoreBreakdown
  });

  assert.ok(facts.strengthFacts.some((fact) => fact.type === "placementPreparationFoundation"));
  assert.ok(facts.strengthFacts.some((fact) => fact.type === "preparationCapacity" && fact.evidenceStrength.dailyStudyHours === 5));
  assert.ok(facts.weaknessFacts.some((fact) => fact.type === "corePreparationDepth"));
  assert.ok(facts.weaknessFacts.every((fact) => !["productionReadiness", "professionalExposure"].includes(fact.type)));
});

test("score explanation preserves deterministic contributions and ranked gaps", () => {
  const facts = buildAnalysisFacts({
    profileData,
    rankedCandidates: [],
    profileWeaknesses: [],
    resumeWeaknesses: ["cloudMissing"],
    resumeFacts: { certifications: [], github: true },
    scoreBreakdown
  });

  assert.equal(facts.scoreExplanation.score, 45);
  assert.equal(facts.scoreExplanation.totalPositiveImpact, 40);
  assert.equal(facts.scoreExplanation.totalNegativeImpact, -10);
  assert.equal(facts.scoreExplanation.firstPriority, facts.weaknessFacts[0].id);
  assert.ok(facts.weaknessFacts.some((fact) => fact.type === "productionReadiness"));
});

test("overlapping project evidence becomes one mentor capability insight", () => {
  const facts = buildAnalysisFacts({
    profileData,
    rankedCandidates: [
      { category: "frontend", projectNames: ["p1"], methods: [], outcomes: [], score: 40 },
      { category: "backend", projectNames: ["p1"], methods: [], outcomes: [], score: 42 },
      { category: "authentication", projectNames: ["p1"], methods: ["authentication"], outcomes: [], score: 38 },
      { category: "databaseIntegration", projectNames: ["p1"], methods: [], outcomes: [], score: 37 }
    ],
    profileWeaknesses: [],
    resumeWeaknesses: [],
    resumeFacts: { certifications: [], github: false },
    scoreBreakdown
  });

  const technical = facts.strengthFacts.filter((fact) => fact.type === "demonstratedTechnicalCapability");
  assert.equal(technical.length, 1);
  assert.equal(technical[0].focus, "backend");
  assert.equal("verifiedCapabilities" in technical[0], false);
  assert.deepEqual(new Set(facts.insightEvidence[technical[0].id].verifiedCapabilities), new Set(["backend", "frontend", "authentication", "databaseIntegration"]));
});
