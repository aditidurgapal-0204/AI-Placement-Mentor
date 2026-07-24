const assert = require("node:assert/strict");
const test = require("node:test");

const { computeReadiness } = require("../../services/readinessEngine");
const { evaluateProjects } = require("../../services/readiness/projectEvaluator");
const { profiles } = require("./fixtures/profileFixtures");
const { resumes } = require("./fixtures/resumeFixtures");

test("current evidence extraction recognizes representative capability families", () => {
  const fullStack = computeReadiness(profiles.fullStack);
  const machineLearning = computeReadiness(profiles.machineLearning);
  const backend = computeReadiness(profiles.backend);
  const frontend = computeReadiness(profiles.frontend);

  assert.equal(fullStack.resumeFacts.projects.count, 1);
  assert.equal(fullStack.resumeFacts.projects.capabilities.backend, true);
  assert.equal(fullStack.resumeFacts.projects.capabilities.deployment, true);
  assert.equal(machineLearning.resumeFacts.projects.capabilities.machineLearning, true);
  assert.equal(machineLearning.resumeFacts.projects.capabilities.dataEngineering, true);
  assert.equal(backend.resumeFacts.projects.capabilities.backend, true);
  assert.equal(backend.resumeFacts.projects.capabilities.scalability, true);
  assert.equal(frontend.resumeFacts.projects.capabilities.frontend, true);
  assert.equal(frontend.resumeFacts.projects.capabilities.deployment, true);
});

test("current unfamiliar-technology handling preserves explicit tokens without inventing known capabilities", () => {
  const evaluated = evaluateProjects(resumes.unfamiliar, "Software Development Engineer", "product");
  assert.deepEqual(evaluated.evaluatedProjects[0].unknownTechnologies, ["NovaFrame", "OrbitStore", "API"]);
  assert.equal(evaluated.capabilities.machineLearning, false);
  assert.equal(evaluated.capabilities.dataEngineering, false);
});

test("current leadership evidence is preserved outside a dedicated leadership section", () => {
  const result = computeReadiness(profiles.leadershipHeavy);
  assert.equal(result.resumeFacts.leadership.exists, true);
  assert.equal(result.resumeFacts.leadership.role, "Technical Team Coordinator");
  assert.equal(result.scoreBreakdown.contributions.find(({ source }) => source === "resume.leadership").points, 3);
});

test("current sparse and no-resume states remain factually distinct", () => {
  const sparse = computeReadiness(profiles.sparse);
  const noResume = computeReadiness(profiles.noResume);

  assert.equal(sparse.extractedMetrics.resumeEvaluated, true);
  assert.equal(sparse.resumeFacts.projects.count, 0);
  assert.ok(sparse.resumeWeaknesses.includes("No technical projects"));
  assert.equal(noResume.extractedMetrics.resumeEvaluated, false);
  assert.equal(noResume.resumeWeaknesses.length, 0);
});

test("current profile propagation preserves preparation capacity", () => {
  const result = computeReadiness(profiles.noResume);
  assert.equal(result.extractedMetrics.timelineMonths, 6);
  assert.equal(result.extractedMetrics.dailyStudyHours, 4);
});
