const assert = require("node:assert/strict");
const test = require("node:test");

const { evaluateProjects } = require("../services/readiness/projectEvaluator");
const { extractResumeMetrics } = require("../services/readiness/resumeParser");
const { rankResumeEvidence } = require("../services/readiness/evidenceRanker");
const { extractLeadershipItems } = require("../services/readiness/structuredProjectEvidence");

const projectResume = (body, extra = "") => `PROJECTS\n${body}\n${extra}\nEDUCATION\nEngineering`;
const analyze = (body, role = "Software Development Engineer", extra = "") => {
  const projects = evaluateProjects(projectResume(body, extra), role, "product");
  const resume = extractResumeMetrics(projectResume(body, extra), projects);
  return { projects, ranked: rankResumeEvidence(resume, role) };
};

test("full-stack evidence prioritizes combined implementation, authentication, database and deployment", () => {
  const result = analyze("Commerce Platform | 2025\nBuilt React frontend, Flask REST API, PostgreSQL database, JWT authentication and deployed on Render.");
  assert.equal(result.projects.evaluatedProjects[0].capabilities.databaseIntegration, true);
  assert.equal(result.ranked.selectedStrengths[0].type, "fullStackDevelopment");
  assert.equal("projectNames" in result.ranked.selectedStrengths[0], false);
  assert.ok((result.ranked.selectedStrengths[0].primaryTechnologies || []).length <= 3);
  assert.ok(result.ranked.rankedCandidates.some((fact) => fact.category === "authentication"));
  assert.ok(result.ranked.rankedCandidates.some((fact) => fact.category === "deployment"));
});

test("ML evidence ranks recommendation methods above incidental frontend evidence", () => {
  const result = analyze("Itinerary Planner | 2025\nBuilt a machine learning recommendation system with content-based filtering, cosine similarity, feature engineering and data preprocessing using Python and Flask. Added a basic React interface.", "ML Engineer");
  const project = result.projects.evaluatedProjects[0];
  assert.deepEqual([project.capabilities.recommendationSystem, project.capabilities.featureEngineering, project.capabilities.dataPreprocessing], [true, true, true]);
  assert.notEqual(result.ranked.selectedStrengths[0].category, "frontend");
  assert.match(result.ranked.topEvidence.strongestProject.name, /Itinerary Planner/);
});

test("frontend evidence retains responsive UI, framework and deployment", () => {
  const result = analyze("Accessible UI | 2025\nBuilt a responsive accessible React interface with state management and deployed it on Vercel.", "Frontend Developer");
  const project = result.projects.evaluatedProjects[0];
  assert.equal(project.capabilities.frontend, true);
  assert.equal(project.capabilities.accessibility, true);
  assert.ok(project.technologies.includes("React"));
  assert.ok(result.ranked.selectedStrengths.some((fact) => fact.category === "frontend"));
});

test("backend evidence retains APIs, database, authentication and architecture", () => {
  const result = analyze("Service Platform | 2025\nArchitected modular Spring Boot REST APIs with PostgreSQL, JWT authentication, caching and system design.", "Backend Developer");
  const categories = result.ranked.selectedStrengths.map((fact) => fact.category);
  assert.equal(result.projects.evaluatedProjects[0].capabilities.systemDesign, true);
  assert.ok(categories.includes("backend"));
  assert.ok(result.ranked.rankedCandidates.some((fact) => fact.category === "databaseIntegration"));
});

test("explicit unfamiliar technologies are preserved", () => {
  const result = analyze("Novel Tool | 2025\nTech stack: SomeNewFramework, QuantumStore\nBuilt an automated workflow.");
  assert.deepEqual(result.projects.evaluatedProjects[0].unknownTechnologies, ["SomeNewFramework", "QuantumStore"]);
});

test("leadership remains available without outranking stronger technical evidence", () => {
  const result = analyze("API Platform | 2025\nBuilt Flask APIs with PostgreSQL and deployment on Render.", "Backend Developer", "EXTRA-CURRICULAR ACTIVITIES\nTechnical Team Coordinator - Coding Club");
  assert.ok(result.ranked.rankedCandidates.some((fact) => fact.category === "leadership"));
  assert.notEqual(result.ranked.selectedStrengths[0].category, "leadership");
});

test("multiple unfamiliar leadership titles are preserved verbatim", () => {
  const items = extractLeadershipItems("EXTRA-CURRICULAR ACTIVITIES\nDocumentation and Content Head - DROID 8.0\nHead - Designer - Creative Club\nOrganizing Committee - Tech Fest\nEDUCATION\nEngineering");
  assert.deepEqual(items.map(({ role, organization }) => ({ role, organization })), [
    { role: "Documentation and Content Head", organization: "DROID 8.0" },
    { role: "Head - Designer", organization: "Creative Club" },
    { role: "Organizing Committee", organization: "Tech Fest" }
  ]);
});

test("a sparse resume does not invent project strengths", () => {
  const projects = evaluateProjects("EDUCATION\nEngineering", "Software Development Engineer", "product");
  const resume = extractResumeMetrics("EDUCATION\nEngineering", projects);
  assert.deepEqual(rankResumeEvidence(resume, "Software Development Engineer").selectedStrengths, []);
});

test("consecutive unrelated resumes do not share project evidence", () => {
  const first = analyze("ML Project | 2025\nBuilt a machine learning recommendation system with Python.", "ML Engineer");
  const second = analyze("Mobile App | 2025\nBuilt a Flutter mobile application.");
  assert.equal(first.projects.capabilities.machineLearning, true);
  assert.equal(second.projects.capabilities.machineLearning, false);
  assert.equal(second.projects.evaluatedProjects.some((project) => project.technologies.includes("Python")), false);
});

test("latest ML-oriented resume preserves all three projects and selects the recommendation project", () => {
  const body = `Itinerary Planner & Recommendation System | 2025
Built an ML itinerary recommendation system using content-based filtering, cosine similarity, data preprocessing and feature engineering with Python and Flask.
ModyMap | 2025
Built a modular route visualization application with OpenStreetMap integration.
Stock Portfolio Tracker | 2025
Built a stock portfolio tracker with Flask backend APIs and data visualization.`;
  const result = analyze(body, "ML Engineer", "EXTRA-CURRICULAR ACTIVITIES\nDocumentation and Content Head - DROID 8.0\nGitHub");
  assert.deepEqual(result.projects.evaluatedProjects.map((project) => project.name), [
    "Itinerary Planner & Recommendation System",
    "ModyMap",
    "Stock Portfolio Tracker"
  ]);
  assert.equal(result.ranked.topEvidence.strongestProject.name, "Itinerary Planner & Recommendation System");
  assert.ok(result.ranked.selectedStrengths.some((fact) => fact.category === "recommendationSystem"));
  assert.ok(result.ranked.selectedStrengths.find((fact) => fact.category === "recommendationSystem").methods.includes("feature engineering"));
  assert.notEqual(result.ranked.selectedStrengths[0].category, "frontend");
});
