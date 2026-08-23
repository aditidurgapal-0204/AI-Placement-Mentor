"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzeEvidence, buildDeterministicAnalysis, analyzePublicResume } = require("../services/publicResumeAnalyzerService");
const { validatePublicResumeAnalysis } = require("../contracts/publicResumeAnalysis.v1");

const strongStudentResume = [
  "Aditi Student", "aditi@example.com | +91 9876543210 | https://github.com/aditi", "SUMMARY",
  "Computer science student building reliable software through academic and personal projects.",
  "EDUCATION", "Bachelor of Technology in Computer Science | 2023 - 2027", "TECHNICAL SKILLS",
  "JavaScript, TypeScript, React, Node.js, Express, PostgreSQL, Git", "PROJECTS",
  "Placement Mentor | 2026", "- Built a React and Node.js application with five student workflows.",
  "- Implemented authentication and PostgreSQL persistence for 200 test records.",
  "Campus Navigator | 2025", "- Developed a responsive mapping interface with three route modes.",
  "- Improved route lookup time by 30% after indexing repeated searches.", "LEADERSHIP",
  "Technical coordinator for a 12-member student society.", "CERTIFICATIONS", "Completed an NPTEL Python course.",
  "ACHIEVEMENTS", "Ranked 2nd in a college project showcase."
].join("\n");

const weakResume = ["Student Name", "student@example.com", "EDUCATION", "B.Tech", "PROJECTS", "Website", "Worked on website"].join("\n");

test("strong student resume receives a deterministic, explainable higher score", () => {
  const first = buildDeterministicAnalysis(strongStudentResume).analysis;
  const second = buildDeterministicAnalysis(strongStudentResume).analysis;
  assert.equal(first.atsScore, second.atsScore);
  assert.ok(first.atsScore >= 75, first.atsScore);
  assert.equal(first.scoreBreakdown.reduce((sum, item) => sum + item.score, 0), first.atsScore);
  assert.deepEqual(validatePublicResumeAnalysis(first), { valid: true, errors: [] });
});

test("weak resume scores lower and receives actionable feedback", () => {
  const strong = buildDeterministicAnalysis(strongStudentResume).analysis;
  const weak = buildDeterministicAnalysis(weakResume).analysis;
  assert.ok(weak.atsScore < strong.atsScore);
  assert.ok(weak.weaknesses.some((item) => /skills|action|brief|measurable/i.test(item)));
  assert.ok(weak.recommendations.some((item) => /action \+ implementation \+ outcome/i.test(item)));
});

test("fresher with projects is not treated as having no practical evidence", () => {
  const result = buildDeterministicAnalysis(strongStudentResume.replace(/LEADERSHIP[\s\S]*$/, "")).analysis;
  assert.ok(result.strengths.some((item) => /fresher-level practical credibility/i.test(item)));
  assert.equal(result.weaknesses.some((item) => /lack.*internship/i.test(item)), false);
});

test("AI failure and malformed output preserve valid deterministic feedback", async () => {
  for (const generateSummary of [async () => { throw new Error("offline"); }, async () => "not-json", async () => ({ summary: "too short" })]) {
    const result = await analyzePublicResume(strongStudentResume, { generateSummary });
    assert.deepEqual(validatePublicResumeAnalysis(result), { valid: true, errors: [] });
    assert.match(result.summary, /deterministic ATS checks/i);
  }
});

test("AI receives facts rather than raw contact or full resume content", async () => {
  let prompt = "";
  await analyzePublicResume(strongStudentResume, { generateSummary: async (value) => { prompt = value; return { summary: "This student resume has clear strengths in its visible evidence and structure. Its main opportunities are improving weaker categories with concise, factual, and outcome-focused descriptions." }; } });
  assert.equal(prompt.includes("aditi@example.com"), false);
  assert.equal(prompt.includes("9876543210"), false);
  assert.equal(prompt.includes("Placement Mentor | 2026"), false);
  assert.match(prompt, /VERIFIED_FACTS/);
});

test("evidence detection does not require a target role or account data", () => {
  const evidence = analyzeEvidence(strongStudentResume);
  assert.ok(evidence.detectedTechnologies.includes("React"));
  assert.equal(Object.hasOwn(evidence, "targetRole"), false);
  assert.equal(Object.hasOwn(evidence, "userId"), false);
});
