const assert = require("node:assert/strict");
const test = require("node:test");

const { extractResumeMetrics } = require("../services/readiness/resumeParser");

const projectFacts = {
  projectCount: 0,
  evaluatedProjects: [],
  capabilities: {},
  projectSummaries: []
};

const certificationsFor = (resumeText) =>
  extractResumeMetrics(resumeText, projectFacts).certifications;

test("returns zero when no certification section exists", () => {
  assert.deepEqual(certificationsFor("EDUCATION\nEngineering\nSKILLS\nJava"), {
    exists: false,
    count: 0
  });
});

test("counts one certification", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\nNPTEL - Internet of Things\nEDUCATION\nEngineering"), {
    exists: true,
    count: 1
  });
});

test("counts multiple bullet certifications once each", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\n• First\n• Second\n• Third\nSKILLS\nJava"), {
    exists: true,
    count: 3
  });
});

test("joins a wrapped certification title to its bullet", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\n• AI in Cybersecurity: Vulnerability, Intelligence,\nSecurity, and Ethics\nEDUCATION\nEngineering"), {
    exists: true,
    count: 1
  });
});

test("deduplicates certification entries", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\n• NPTEL - IoT\n•  nptel   - iot\nSKILLS\nJava"), {
    exists: true,
    count: 1
  });
});

test("ignores certification words outside the section", () => {
  assert.deepEqual(certificationsFor("SUMMARY\nSeeking certification opportunities\nEDUCATION\nEngineering"), {
    exists: false,
    count: 0
  });
});

test("heading with no entries returns zero", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\n\nSKILLS\nJava"), {
    exists: false,
    count: 0
  });
});

test("supports mixed bullet styles and blank lines", () => {
  assert.deepEqual(certificationsFor("CERTIFICATIONS\n- First\n\n• Second\n  \n* Third\nEDUCATION\nEngineering"), {
    exists: true,
    count: 3
  });
});

test("counts the current resume certification section as four", () => {
  const resumeText = `CERTIFICATIONS
• Alison - AI in Cybersecurity: Vulnerability, Intelligence, Security, and Ethics
• NPTEL - Internet of Things (IoT)
• Infosys Springboard - C Programming
• Infosys Springboard - Python Programming
EDUCATION
Engineering`;

  assert.deepEqual(certificationsFor(resumeText), {
    exists: true,
    count: 4
  });
});
