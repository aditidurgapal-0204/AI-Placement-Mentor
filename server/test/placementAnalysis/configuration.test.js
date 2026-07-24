const assert = require("node:assert/strict");
const test = require("node:test");

const { ROLE_COMPETENCIES } = require("../../configs/roleCompetencies.v1");
const { MENTOR_REASONING_RULES } = require("../../configs/mentorReasoningRules.v1");
const { READINESS_LABELS } = require("../../configs/readinessLabels.v1");

const ONBOARDING_ROLES = [
  "Software Development Engineer (SDE)",
  "Frontend Developer",
  "Backend Developer",
  "Full-Stack Engineer",
  "Machine Learning Engineer",
  "Data Scientist",
  "Data Analyst",
  "Cloud / DevOps Engineer",
  "Cybersecurity Analyst",
  "Product Manager (Associate)",
  "Mobile App Developer (iOS/Android)",
  "Embedded Systems / IoT Engineer"
];

test("versioned role competencies cover every current onboarding role exactly once", () => {
  const configured = Object.values(ROLE_COMPETENCIES).flatMap(({ onboardingValues }) => onboardingValues);
  assert.deepEqual([...configured].sort(), [...ONBOARDING_ROLES].sort());
  assert.equal(new Set(configured).size, configured.length);
});

test("role competencies use normalized capability categories and bounded relevance", () => {
  Object.entries(ROLE_COMPETENCIES).forEach(([role, definition]) => {
    assert.ok(Object.keys(definition.competencies).length > 0, `${role} requires competencies`);
    Object.entries(definition.competencies).forEach(([capability, relevance]) => {
      assert.match(capability, /^[a-z][A-Za-z]+$/);
      assert.ok(Number.isInteger(relevance) && relevance >= 1 && relevance <= 5);
    });
  });
});

test("mentor reasoning configuration cannot alter readiness scoring", () => {
  assert.equal(MENTOR_REASONING_RULES.affectsReadinessScore, false);
  assert.equal(READINESS_LABELS.affectsReadinessScore, false);
  assert.equal(MENTOR_REASONING_RULES.blockers.scoreBlockerRequiresNegativeContribution, true);
  assert.equal(MENTOR_REASONING_RULES.priority.maximum, 1);
});

test("reasoning weights are normalized and generalized", () => {
  const strengthTotal = Object.values(MENTOR_REASONING_RULES.strengths.rankingWeights)
    .reduce((total, value) => total + value, 0);
  const priorityTotal = Object.values(MENTOR_REASONING_RULES.priority.rankingWeights)
    .reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(strengthTotal - 1) < Number.EPSILON);
  assert.ok(Math.abs(priorityTotal - 1) < Number.EPSILON);

  const serialized = JSON.stringify(MENTOR_REASONING_RULES).toLowerCase();
  ["react", "postgresql", "tensorflow", "aditi", "project name", "resume name"]
    .forEach((forbidden) => assert.equal(serialized.includes(forbidden), false));
});

test("readiness labels are configurable ordered presentation bands", () => {
  const minimums = READINESS_LABELS.bands.map(({ minimum }) => minimum);
  assert.deepEqual(minimums, [...minimums].sort((a, b) => a - b));
  assert.equal(READINESS_LABELS.bands[0].minimum, 0);
  assert.ok(READINESS_LABELS.bands.every(({ key, label }) => key && label));
});
