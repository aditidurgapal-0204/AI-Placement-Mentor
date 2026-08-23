"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzeEvidence, buildDeterministicAnalysis, analyzePublicResume } = require("../services/publicResumeAnalyzerService");
const { validatePublicResumeAnalysis } = require("../contracts/publicResumeAnalysis.v1");

const strongStudentResume = [
  "Aditi Student", "aditi@example.com | +91 9876543210 | https://github.com/aditi", "SUMMARY",
  "Computer science student building reliable software through academic and personal projects.",
  "EDUCATION", "Bachelor of Technology in Computer Science | 2023 - 2027", "TECHNICAL SKILLS",
  "JavaScript, TypeScript, React, Node.js, Express, PostgreSQL, Git", "PROJECTS",
  "Placement Mentor | 2026", "- Built a React and Node.js application with five student workflows.",
  "- Implemented authentication and PostgreSQL persistence for 200 test records.",
  "Campus Navigator | 2025", "- Developed a responsive mapping interface with three route modes.",
  "- Improved route lookup time by 30% after indexing repeated searches.", "LEADERSHIP",
  "Technical coordinator for a 12-member student society.", "CERTIFICATIONS", "Completed an NPTEL Python course.",
  "ACHIEVEMENTS", "Ranked 2nd in a college project showcase."
].join("\n");

const weakResume = ["Student Name", "student@example.com", "EDUCATION", "B.Tech", "PROJECTS", "Website", "Worked on website"].join("\n");
const sectionFeedbackFor = (resumeText, section) => buildDeterministicAnalysis(resumeText).analysis.sectionFeedback
  .find((item) => item.section === section);

test("strong student resume receives a deterministic, explainable higher score", () => {
  const first = buildDeterministicAnalysis(strongStudentResume).analysis;
  const second = buildDeterministicAnalysis(strongStudentResume).analysis;
  assert.equal(first.atsScore, second.atsScore);
  assert.ok(first.atsScore >= 75, first.atsScore);
  assert.equal(first.scoreBreakdown.reduce((sum, item) => sum + item.score, 0), first.atsScore);
  assert.deepEqual(validatePublicResumeAnalysis(first), { valid: true, errors: [] });
});

test("weak resume scores lower and receives actionable feedback", () => {
  const strong = buildDeterministicAnalysis(strongStudentResume).analysis;
  const weak = buildDeterministicAnalysis(weakResume).analysis;
  assert.ok(weak.atsScore < strong.atsScore);
  assert.ok(weak.weaknesses.some((item) => /skills|action|brief|measurable/i.test(item)));
  assert.ok(weak.recommendations.some((item) => /action \+ implementation \+ outcome/i.test(item)));
});

test("fresher with projects is not treated as having no practical evidence", () => {
  const result = buildDeterministicAnalysis(strongStudentResume.replace(/LEADERSHIP[\s\S]*$/, "")).analysis;
  assert.ok(result.strengths.some((item) => /fresher-level practical credibility/i.test(item)));
  assert.equal(result.weaknesses.some((item) => /lack.*internship/i.test(item)), false);
});

test("AI failure and malformed output preserve valid deterministic feedback", async () => {
  for (const generateSummary of [async () => { throw new Error("offline"); }, async () => "not-json", async () => ({ summary: "too short" })]) {
    const result = await analyzePublicResume(strongStudentResume, { generateSummary });
    assert.deepEqual(validatePublicResumeAnalysis(result), { valid: true, errors: [] });
    assert.match(result.summary, /deterministic ATS checks/i);
  }
});

test("AI receives facts rather than raw contact or full resume content", async () => {
  let prompt = "";
  await analyzePublicResume(strongStudentResume, { generateSummary: async (value) => { prompt = value; return { summary: "This student resume has clear strengths in its visible evidence and structure. Its main opportunities are improving weaker categories with concise, factual, and outcome-focused descriptions." }; } });
  assert.equal(prompt.includes("aditi@example.com"), false);
  assert.equal(prompt.includes("9876543210"), false);
  assert.equal(prompt.includes("Placement Mentor | 2026"), false);
  assert.match(prompt, /VERIFIED_FACTS/);
});

test("evidence detection does not require a target role or account data", () => {
  const evidence = analyzeEvidence(strongStudentResume);
  assert.ok(evidence.detectedTechnologies.includes("React"));
  assert.equal(Object.hasOwn(evidence, "targetRole"), false);
  assert.equal(Object.hasOwn(evidence, "userId"), false);
});

test("detects Professional Summary as a real populated section", () => {
  const resume = "PROFESSIONAL SUMMARY\nFinal-year computer science student building reliable software.\nEDUCATION\nB.Tech";
  const feedback = sectionFeedbackFor(resume, "Summary / Objective");
  assert.equal(feedback.status, "Present");
  assert.match(feedback.feedback, /present/i);
  assert.doesNotMatch(feedback.feedback, /add a concise summary/i);
});

test("supports normalized Summary and Objective heading aliases", () => {
  for (const heading of ["SUMMARY", "Professional Profile", "PROFILE", "Career Summary", "Career Objective", "Professional Objective"]) {
    const feedback = sectionFeedbackFor(`${heading}\nComputer science student focused on reliable software engineering outcomes.\nEDUCATION\nB.Tech`, "Summary / Objective");
    assert.equal(feedback.status, "Present", heading);
  }
});

test("detects Objective as a real populated section", () => {
  const feedback = sectionFeedbackFor("Objective\nMotivated Computer Science undergraduate seeking software roles.\nEDUCATION\nB.Tech", "Summary / Objective");
  assert.equal(feedback.status, "Present");
});

test("detects summary headings merged with content by PDF row extraction", () => {
  for (const text of [
    "PROFESSIONAL SUMMARY Final-year computer science student building reliable software.\nEDUCATION\nB.Tech",
    "Professional Summary – Final-year computer science student building reliable software.\nEDUCATION\nB.Tech",
    "Objective Motivated Computer Science undergraduate seeking software roles.\nEDUCATION\nB.Tech",
    "PROFESSIONALSUMMARY\nFinal-year computer science student building reliable software.\nEDUCATION\nB.Tech"
  ]) {
    assert.equal(sectionFeedbackFor(text, "Summary / Objective").status, "Present", text);
  }
});

test("does not infer a summary section from project-description prose", () => {
  for (const text of [
    "PROJECTS\nProject summary generated by the reporting module.\nEDUCATION\nB.Tech",
    "PROJECTS\nSummary generated by the reporting module.\nEDUCATION\nB.Tech"
  ]) {
    assert.equal(sectionFeedbackFor(text, "Summary / Objective").status, "Missing", text);
  }
});

test("detects entries under a dedicated Certifications section", () => {
  const feedback = sectionFeedbackFor("CERTIFICATIONS\nNPTEL - Internet of Things\nInfosys Springboard - Python Programming\nEDUCATION\nB.Tech", "Certifications");
  assert.equal(feedback.status, "Present");
  assert.match(feedback.feedback, /dedicated section/i);
});

test("supports normalized certification heading aliases and separators", () => {
  for (const heading of ["CERTIFICATE", "CERTIFICATES & COURSES", "Courses / Certifications", "PROFESSIONAL CERTIFICATIONS", "Training & Certifications"]) {
    const feedback = sectionFeedbackFor(`${heading}\nNPTEL - Internet of Things\nEDUCATION\nB.Tech`, "Certifications");
    assert.equal(feedback.status, "Present", heading);
  }
});

test("detects structured certification or training evidence under another section", () => {
  const resume = "Objective\nMotivated Computer Science undergraduate.\nCo-curricular Activities\n• Infosys Springboard – Python Programming\n• Infosys Springboard – C Programming\nEDUCATION\nB.Tech";
  const analysis = buildDeterministicAnalysis(resume).analysis;
  assert.equal(analysis.sectionFeedback.find((item) => item.section === "Summary / Objective").status, "Present");
  const feedback = analysis.sectionFeedback.find((item) => item.section === "Certifications");
  assert.equal(feedback.status, "Present");
  assert.match(feedback.feedback, /Infosys Springboard/i);
  assert.match(feedback.feedback, /dedicated Certifications section/i);
});

test("detects credible credential-style entries without relying on one provider whitelist", () => {
  for (const entry of [
    "AWS Certified Cloud Practitioner",
    "Google Data Analytics Certificate",
    "Microsoft Azure Fundamentals",
    "Mody Learning Institute – Distributed Systems Fundamentals"
  ]) {
    const feedback = sectionFeedbackFor(`ACHIEVEMENTS\n${entry}\nEDUCATION\nB.Tech`, "Certifications");
    assert.equal(feedback.status, "Present", entry);
  }
});

test("keeps Certifications missing when no credible evidence exists", () => {
  const feedback = sectionFeedbackFor("EDUCATION\nB.Tech\nSKILLS\nJavaScript", "Certifications");
  assert.equal(feedback.status, "Missing");
});

test("does not infer a certification from arbitrary training prose", () => {
  for (const sentence of [
    "Completed project training for team members.",
    "Implemented certificate validation in the application.",
    "AI Placement Mentor – Web Development"
  ]) {
    const feedback = sectionFeedbackFor(`ACHIEVEMENTS\n${sentence}\nEDUCATION\nB.Tech`, "Certifications");
    assert.equal(feedback.status, "Missing", sentence);
  }
});
