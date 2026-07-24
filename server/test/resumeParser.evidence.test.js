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
