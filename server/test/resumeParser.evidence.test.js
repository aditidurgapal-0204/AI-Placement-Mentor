const assert = require("node:assert/strict");
const test = require("node:test");

const { extractResumeMetrics } = require("../services/readiness/resumeParser");
const { detectSections } = require("../services/resume/sectionDetector");

const projectFacts = { projectCount: 0, evaluatedProjects: [], capabilities: {}, projectSummaries: [] };
const metricsFor = (text) => extractResumeMetrics(text, projectFacts);

for (const text of [
  "Contributed technical articles to the college magazine",
  "Contributed to the technical society",
  "GitHub: https://github.com/student",
  "PROJECTS\nPersonal GitHub projects"
]) {
  test(`does not infer open source from: ${text}`, () => {
    assert.equal(metricsFor(text).openSource.exists, false);
  });
}

for (const text of [
  "Contributed to an open-source repository",
  "Merged 4 pull requests in an open-source project",
  "Google Summer of Code contributor"
]) {
  test(`detects explicit open-source evidence: ${text}`, () => {
    assert.equal(metricsFor(text).openSource.exists, true);
  });
}

for (const text of [
  "Published two technical articles in a college magazine",
  "Strong research and writing skills",
  "The article was published"
]) {
  test(`does not infer academic research from: ${text}`, () => {
    assert.deepEqual(metricsFor(text).research, { exists: false, publicationType: null });
  });
}

test("detects an IEEE research paper", () => {
  assert.deepEqual(metricsFor("Published a research paper in IEEE Xplore").research, {
    exists: true,
    publicationType: "IEEE"
  });
});

test("detects an academic conference paper", () => {
  assert.deepEqual(metricsFor("Presented a paper at an academic conference").research, {
    exists: true,
    publicationType: "Conference"
  });
});

test("detects an international journal publication", () => {
  assert.deepEqual(metricsFor("Published in the International Journal of XYZ").research, {
    exists: true,
    publicationType: "International Journal"
  });
});

test("preserves leadership detection from extracurricular content", () => {
  const text = "EXTRA-CURRICULAR ACTIVITIES\nTechnical Team Coordinator - Enginium\nEDUCATION\nEngineering";
  assert.equal(detectSections(text).leadership.trim(), "");
  assert.deepEqual(metricsFor(text).leadership, {
    exists: true,
    role: "Technical Team Coordinator",
    organization: "Enginium"
  });
});

test("does not invent leadership evidence", () => {
  assert.equal(metricsFor("EDUCATION\nEngineering").leadership.exists, false);
});

test("detects summer intern titles in experience sections", () => {
  const text = [
    "EXPERIENCE",
    "Summer Intern | Product Labs",
    "Built internal tooling with a product engineering team.",
    "EDUCATION",
    "Bachelor of Engineering"
  ].join("\n");
  assert.equal(metricsFor(text).internship.exists, true);
  assert.equal(metricsFor(text).internship.organization, "Product Labs");
});

test("representative Aditi-like resume keeps leadership, projects, GitHub, and certifications stable", () => {
  const text = [
    "Aditi Durgapal",
    "GitHub: https://github.com/aditi",
    "PROJECTS",
    "AIPlacementMentor | 2025",
    "Built a full-stack mentor platform with authentication and PostgreSQL.",
    "ModyMap | 2025",
    "Built a modular route visualization application with OpenStreetMap integration.",
    "EXTRA-CURRICULAR ACTIVITIES",
    "Technical Team Coordinator – Enginium",
    "CERTIFICATIONS",
    "Completed Python Programming certificate",
    "Completed Web Development certificate",
    "Completed Data Structures certificate",
    "Completed SQL certificate",
    "EDUCATION",
    "Bachelor of Engineering"
  ].join("\n");

  const metrics = metricsFor(text);
  assert.equal(metrics.leadership.exists, true);
  assert.equal(metrics.leadership.role, "Technical Team Coordinator");
  assert.equal(metrics.leadership.organization, "Enginium");
  assert.equal(metrics.hasGitHub, true);
  assert.equal(metrics.internship.exists, false);
  assert.ok(metrics.certifications.count >= 4);
  assert.equal(metrics.openSource.exists, false);
});
