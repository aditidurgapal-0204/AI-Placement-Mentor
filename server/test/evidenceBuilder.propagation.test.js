const assert = require("node:assert/strict");
const test = require("node:test");

const { buildEvidenceLists } = require("../services/readiness/evidenceBuilder");

test("propagates study hours and GitHub evidence into readiness facts", () => {
  const profileData = {
    skills: {},
    cgpa: "8.0",
    timeline: {
      preparationTimelineMonths: 6,
      dailyStudyHours: 5
    },
    resumeText: "Resume supplied"
  };
  const resumeEvidence = {
    internship: { exists: false },
    leadership: { exists: false },
    research: { exists: false },
    competitiveProgramming: { exists: false },
    hackathons: { exists: false },
    openSource: { exists: false },
    hasGitHub: true,
    certifications: { exists: true, count: 4 },
    detectedTechnologies: [],
    projects: {
      projectCount: 0,
      evaluatedProjects: [],
      capabilities: {},
      projectSummaries: [],
      complexity: "None",
      overallProjectQuality: "None"
    }
  };

  const facts = buildEvidenceLists(profileData, resumeEvidence, {}, false);

  assert.equal(facts.extractedMetrics.timelineMonths, 6);
  assert.equal(facts.extractedMetrics.dailyStudyHours, 5);
  assert.equal(facts.resumeFacts.github, true);
});
