"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { extractResumeMetrics } = require("../../services/readiness/resumeParser");
const { evaluateProjects } = require("../../services/readiness/projectEvaluator");
const { createMentorAnalysisSnapshot } = require("../../services/placementAnalysis/analysisOrchestrator");
const { createPresentationSafeGeminiDto, generateAnalysisLanguage } = require("../../services/placementAnalysis/analysisLanguageService");
const { validateGeminiGrounding } = require("../../services/placementAnalysis/geminiGroundingValidator");
const { profileWith } = require("./fixtures/profileFixtures");

const resume = [
  "PROJECTS",
  "Orbit Planner | https://example.test (Jan 2025 - May 2025)",
  "Built a React frontend with authentication, PostgreSQL database integration and Vercel deployment.",
  "EXTRA-CURRICULAR ACTIVITIES",
  "Technical Team Coordinator - Engineering Society",
  "Member of the Public Speaking Society and anchored college events.",
  "Volunteered with a community NGO.",
  "Completed NPTEL Python Programming course with certificate.",
  "EDUCATION",
  "Bachelor of Engineering"
].join("\n");

const profile = () => profileWith({ resumeText: resume, skills: { dsa: "Intermediate", dbms: "Beginner" } });
const snapshot = () => createMentorAnalysisSnapshot(profile(), {
  analysisId: "repair-analysis", requestId: "repair-request", createdAt: "2026-07-20T00:00:00.000Z"
});

test("canonical project identity is sanitized and preserves verified concrete facts", () => {
  const current = snapshot();
  const projects = current.internalTrace.canonicalEvidence.evidence.filter(({ type }) => type === "project_evidence");
  assert.equal(projects.length, 1);
  assert.equal(projects[0].value.displayName, "Orbit Planner");
  assert.equal(projects[0].value.complexity, "advanced");
  assert.ok(projects[0].value.technologies.includes("React"));
  assert.ok(projects[0].value.capabilities.includes("deployment"));
  assert.equal(JSON.stringify(projects).includes("https://"), false);
});

test("supplemental resume classification remains typed and requires certificate evidence", () => {
  const projects = evaluateProjects(resume, "Software Development Engineer", "product");
  const metrics = extractResumeMetrics(resume, projects);
  assert.ok(metrics.activities.publicSpeaking.length > 0);
  assert.ok(metrics.activities.societyParticipation.length > 0);
  assert.ok(metrics.activities.volunteering.length > 0);
  assert.equal(metrics.certifications.exists, true);
  assert.equal(metrics.certifications.count, 1);
  const ordinaryCourse = extractResumeMetrics("ADDITIONAL INFORMATION\nStudied Python Programming", evaluateProjects("", "Software Development Engineer", "product"));
  assert.equal(ordinaryCourse.certifications.exists, false);
});

test("mentor reasoning keeps bounded concrete project and skill evidence in score drivers", () => {
  const current = snapshot();
  assert.ok(current.scoreDrivers.some(({ facts }) => facts.supportingFacts.projectExamples.some(({ name }) => name === "Orbit Planner")));
  assert.ok(current.scoreDrivers.some(({ facts }) => facts.supportingFacts.skillFacts.some(({ skill, level }) => skill === "dsa" && level === "Intermediate")));
  current.scoreDrivers.forEach(({ facts: { supportingFacts } }) => {
    assert.ok(supportingFacts.projectExamples.length <= 2);
    supportingFacts.projectExamples.forEach(({ technologies }) => assert.ok(technologies.length <= 4));
  });
});

test("presentation DTO exposes selected safe evidence but never resume text or private traces", () => {
  const dto = createPresentationSafeGeminiDto(snapshot());
  const serialized = JSON.stringify(dto);
  assert.ok(serialized.includes("Orbit Planner"));
  assert.ok(serialized.includes("React"));
  for (const forbidden of ["resumeText", "internalTrace", "evidenceIds", "contributionIds", "projectKey", "https://"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.ok(serialized.length <= 24000);
});

test("grounding accepts safe fallback and rejects invented project, technology and skill claims", async () => {
  const result = await generateAnalysisLanguage(snapshot());
  assert.deepEqual(validateGeminiGrounding(result.output, result.dto), { valid: true, errors: [] });

  const inventedProject = structuredClone(result.output);
  inventedProject.strengths[0].text = "Phantom Project demonstrates practical implementation. This supports the selected role.";
  assert.equal(validateGeminiGrounding(inventedProject, result.dto).valid, false);

  const inventedTechnology = structuredClone(result.output);
  inventedTechnology.strengths[0].text = "The application was built with QuantumDB. This supports the selected role.";
  assert.equal(validateGeminiGrounding(inventedTechnology, result.dto).valid, false);

  const inventedSkill = structuredClone(result.output);
  inventedSkill.strengths[0].text = "Advanced DSA supports technical interviews. This supports the selected role.";
  assert.equal(validateGeminiGrounding(inventedSkill, result.dto).valid, false);
});
