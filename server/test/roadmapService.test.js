"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildFallbackRoadmap, fingerprintRoadmapInput, generateRoadmap } = require("../services/roadmapService");

const profile = (overrides = {}) => ({
  branch: "CSE", year: "3", cgpa: 8.2, companyType: "Product-based", targetRole: "SDE",
  skills: { dsa: "Beginner", dbms: "Intermediate", os: "Beginner", networks: "Intermediate", aptitude: "Intermediate", communication: "Strong" },
  timeline: { preparationTimelineMonths: 4, dailyStudyHours: 3 }, resumeAvailable: true,
  ...overrides
});
const analysis = { readiness: { score: 48 }, context: { resumeProvided: true }, strengths: [{ text: "Strong communication" }], scoreBlockers: [{ text: "Project deployment evidence is missing" }], careerRisks: [], firstPriority: { text: "Strengthen DSA and OS" } };

test("beginner SDE receives exact timeline with DSA prioritized and realistic workload", () => {
  const result = buildFallbackRoadmap(profile(), analysis);
  assert.equal(result.durationMonths, 4);
  assert.equal(result.roadmap.length, 4);
  assert.ok(result.roadmap[0].topics.includes("DSA"));
  assert.ok(result.roadmap.some((month) => month.goals.some((goal) => /35 level-appropriate DSA problems/.test(goal))));
  assert.equal(JSON.stringify(result).includes("Communication"), false);
});

test("advanced DSA does not receive elementary DSA workload", () => {
  const result = buildFallbackRoadmap(profile({ skills: { ...profile().skills, dsa: "Advanced" } }), analysis);
  assert.equal(result.roadmap.some((month) => month.goals.some((goal) => /level-appropriate DSA problems/.test(goal))), false);
});

test("ML Engineer receives six ML-oriented months", () => {
  const result = buildFallbackRoadmap(profile({ targetRole: "ML Engineer", timeline: { preparationTimelineMonths: 6, dailyStudyHours: 3 } }), analysis);
  assert.equal(result.roadmap.length, 6);
  assert.ok(JSON.stringify(result).includes("ML fundamentals"));
  assert.ok(JSON.stringify(result).includes("model evaluation"));
});

test("strong frontend development and weak DSA balances role content with DSA", () => {
  const result = buildFallbackRoadmap(profile({ targetRole: "Frontend Developer", timeline: { preparationTimelineMonths: 3, dailyStudyHours: 3 } }), analysis);
  const serialized = JSON.stringify(result);
  assert.ok(serialized.includes("JavaScript"));
  assert.ok(serialized.includes("DSA"));
});

test("no-resume roadmap remains valid", () => {
  const result = buildFallbackRoadmap(profile({ resumeAvailable: false }), { ...analysis, context: { resumeProvided: false }, scoreBlockers: [] });
  assert.equal(result.roadmap.length, 4);
  assert.ok(result.roadmap.every((month) => month.topics.length >= 2 && month.goals.length >= 2));
});

test("invalid Gemini JSON returns deterministic fallback", async () => {
  const result = await generateRoadmap(profile(), analysis, { generate: async () => "not-json" });
  assert.equal(result.source, "deterministic_fallback");
  assert.equal(result.roadmap.length, 4);
});

test("valid Gemini JSON is accepted only with exact month count", async () => {
  const fallback = buildFallbackRoadmap(profile(), analysis);
  const result = await generateRoadmap(profile(), analysis, { generate: async () => ({ roadmap: fallback.roadmap }) });
  assert.equal(result.source, "gemini");
  assert.equal(result.roadmap.length, 4);
});

test("one hour and five hours produce different workloads", () => {
  const low = JSON.stringify(buildFallbackRoadmap(profile({ timeline: { preparationTimelineMonths: 4, dailyStudyHours: 1 } }), analysis));
  const high = JSON.stringify(buildFallbackRoadmap(profile({ timeline: { preparationTimelineMonths: 4, dailyStudyHours: 5 } }), analysis));
  assert.ok(low.includes("15 level-appropriate DSA problems"));
  assert.ok(high.includes("55 level-appropriate DSA problems"));
});

test("fingerprint is stable for unchanged facts and changes with preparation inputs", () => {
  assert.equal(fingerprintRoadmapInput(profile(), analysis), fingerprintRoadmapInput(profile(), structuredClone(analysis)));
  assert.notEqual(fingerprintRoadmapInput(profile(), analysis), fingerprintRoadmapInput(profile({ timeline: { preparationTimelineMonths: 3, dailyStudyHours: 3 } }), analysis));
});
