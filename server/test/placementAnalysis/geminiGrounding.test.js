"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { validateGeminiGrounding } = require("../../services/placementAnalysis/geminiGroundingValidator");

const validGeminiInput = () => ({
  version: "1.0",
  analysisId: "analysis-test",
  context: {
    targetRole: "Software Development Engineer (SDE)", companyType: "Product Based",
    timelineMonths: 6, dailyStudyHours: 4, resumeProvided: true
  },
  readiness: {
    score: 54, labelKey: "progressing",
    meaning: "The current result reflects meaningful preparation and an assessed score constraint."
  },
  strengths: [{
    id: "strength-1", conclusion: "The student has demonstrated practical technical execution.",
    studentMeaning: "This provides useful implementation evidence.",
    roleConnection: "It supports the selected role's implementation expectations."
  }],
  scoreBlockers: [{
    id: "blocker-1", conclusion: "One assessed foundation remains below the selected target.",
    studentMeaning: "This directly limits the current readiness result.",
    roleConnection: "The selected role requires greater consistency in this area."
  }],
  careerRisks: [{
    id: "risk-1", conclusion: "Professional-context evidence is currently limited.",
    studentMeaning: "This may make workplace readiness harder to demonstrate.",
    roleConnection: "Additional exposure would support recruiter confidence.", affectsCurrentScore: false
  }],
  priority: {
    id: "priority-1", objective: "Improve the highest-impact assessed constraint.",
    whyFirst: "It directly affects current readiness."
  }
});

const validOutput = () => ({
  analysisId: "analysis-test",
  diagnosis: "You have a practical technical base that supports your current placement preparation. Your implementation work is the clearest advantage for the role you selected. Greater consistency in a core interview subject is currently limiting your readiness. Improve that subject first through regular practice, then keep building on the project work that already helps your profile.",
  strengths: [{ insightId: "strength-1", text: "Practical technical execution provides a useful role foundation." }],
  scoreBlockers: [{ insightId: "blocker-1", text: "A core interview subject needs more consistent practice for the selected role." }],
  careerRisks: [{ insightId: "risk-1", text: "More workplace experience would make your responsibility easier for recruiters to judge." }],
  priority: { insightId: "priority-1", text: "Build consistent practice in the core subject that most affects your current readiness." }
});

test("grounding accepts a complete ID-preserving language response", () => {
  assert.deepEqual(validateGeminiGrounding(validOutput(), validGeminiInput()), { valid: true, errors: [] });
});

test("grounding rejects invented, missing, duplicated, and reordered insight identifiers", () => {
  const cases = [
    (output) => { output.strengths[0].insightId = "invented"; },
    (output) => { output.strengths = []; },
    (output) => { output.scoreBlockers.push({ ...output.scoreBlockers[0] }); },
    (output) => { output.careerRisks.unshift({ insightId: "risk-extra", text: "Extra." }); }
  ];
  cases.forEach((mutate) => {
    const output = validOutput();
    mutate(output);
    assert.equal(validateGeminiGrounding(output, validGeminiInput()).valid, false);
  });
});

test("grounding rejects duplicated wording across insight cards", () => {
  const output = validOutput();
  output.scoreBlockers.push({ insightId: "blocker-duplicate", text: output.scoreBlockers[0].text });
  const input = validGeminiInput();
  input.scoreBlockers.push({ ...input.scoreBlockers[0], id: "blocker-duplicate" });
  const result = validateGeminiGrounding(output, input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must not repeat identical insight text")));
});

test("grounding rejects numeric claims that are absent from the backend DTO", () => {
  const output = validOutput();
  output.diagnosis += " This will improve readiness by 17 points.";
  const result = validateGeminiGrounding(output, validGeminiInput());
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("unapproved numeric claim 17")));
});

test("grounding prevents career risks from claiming current-score causality", () => {
  const output = validOutput();
  output.careerRisks[0].text = "This lowers the readiness score.";
  const result = validateGeminiGrounding(output, validGeminiInput());
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must not claim current score causality")));
});
