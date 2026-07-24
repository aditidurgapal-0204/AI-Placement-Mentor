const assert = require("node:assert/strict");
const test = require("node:test");

const { computeReadiness } = require("../../services/readinessEngine");
const { profiles } = require("./fixtures/profileFixtures");

test("a completely different resume replaces prior project capabilities", () => {
  const first = computeReadiness(profiles.machineLearning);
  const replacement = computeReadiness(profiles.frontend);

  assert.equal(first.resumeFacts.projects.capabilities.machineLearning, true);
  assert.equal(replacement.resumeFacts.projects.capabilities.machineLearning, false);
  assert.equal(replacement.resumeFacts.projects.capabilities.dataEngineering, false);
  assert.equal(replacement.resumeFacts.projects.capabilities.frontend, true);
  assert.equal(replacement.strengthFacts.some(({ focus }) => focus === "recommendationSystem" || focus === "machineLearning"), false);
});

test("repeated mixed analyses do not mutate earlier analysis results", () => {
  const first = computeReadiness(profiles.backend);
  const frozenSnapshot = JSON.stringify(first);

  computeReadiness(profiles.machineLearning);
  computeReadiness(profiles.unfamiliar);
  computeReadiness(profiles.noResume);

  assert.equal(JSON.stringify(first), frozenSnapshot);
  assert.equal(first.resumeFacts.projects.capabilities.backend, true);
  assert.equal(first.resumeFacts.projects.capabilities.machineLearning, false);
});
