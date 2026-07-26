"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RESUME_FACTS_VERSION,
  RESUME_FACTS_RESPONSE_SCHEMA,
  validateResumeFacts
} = require("../contracts/resumeFacts.v1");
const { extractResumeFacts } = require("../services/resumeExtraction/resumeExtractionService");
const { adaptResumeFactsToEngineEvidence } = require("../services/resumeExtraction/resumeFactsAdapter");
const { extractWithGemini } = require("../services/resumeExtraction/geminiResumeExtractor");

const resumeText = [
  "PROJECTS",
  "Placement Mentor",
  "Built a full-stack application with authentication and deployed it on Vercel.",
  "EXPERIENCE",
  "Software Engineering Internship at Acme",
  "LEADERSHIP",
  "Technical Team Coordinator at Engineering Society",
  "CERTIFICATIONS",
  "Cloud Fundamentals Certification",
  "GitHub: https://github.com/student"
].join("\n");

const evidence = (quote) => {
  const startOffset = resumeText.indexOf(quote);
  return { quote, startOffset, endOffset: startOffset + quote.length };
};

const validFacts = () => ({
  schemaVersion: RESUME_FACTS_VERSION,
  resumeStatus: "assessed",
  projects: [{
    name: "Placement Mentor",
    technologies: ["Vercel"],
    capabilities: ["frontend", "backend", "authentication", "deployment"],
    complexity: "intermediate",
    roleRelevance: "high",
    deployment: "verified",
    cloud: "not_verified",
    scalability: "not_verified",
    testing: "unknown",
    confidence: 0.95,
    evidence: evidence("Placement Mentor")
  }],
  experience: [{ name: "Software Engineering Internship at Acme", kind: "internship", confidence: 0.94, evidence: evidence("Software Engineering Internship at Acme") }],
  certifications: [{ name: "Cloud Fundamentals Certification", kind: "certification", confidence: 0.96, evidence: evidence("Cloud Fundamentals Certification") }],
  leadership: [{ name: "Technical Team Coordinator", organization: "Engineering Society", confidence: 0.95, evidence: evidence("Technical Team Coordinator at Engineering Society") }],
  activities: [],
  achievements: [],
  skills: [],
  portfolioLinks: [{ name: "GitHub", kind: "github", confidence: 0.99, evidence: evidence("GitHub") }],
  warnings: []
});

test("resume-facts contract accepts source-grounded structured extraction", () => {
  assert.deepEqual(validateResumeFacts(validFacts(), { resumeText }), { valid: true, errors: [] });
});

test("resume-facts contract rejects an evidence offset that does not point to its quote", () => {
  const facts = validFacts();
  facts.projects[0].evidence.startOffset += 1;
  const result = validateResumeFacts(facts, { resumeText });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("offsets")));
});

test("resume-facts contract rejects fields outside the strict extraction schema", () => {
  const facts = validFacts();
  facts.projects[0].inferredImpact = "not supported";
  facts.unreviewedProviderMetadata = true;
  const result = validateResumeFacts(facts, { resumeText });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("inferredImpact is not supported")));
  assert.ok(result.errors.some((error) => error.includes("unreviewedProviderMetadata is not supported")));
  assert.equal(RESUME_FACTS_RESPONSE_SCHEMA.properties.projects.items.properties.evidence.type, "object");
  assert.deepEqual(RESUME_FACTS_RESPONSE_SCHEMA.properties.projects.items.required.includes("evidence"), true);
});

test("validated resume facts retain project, internship, portfolio, certification, and leadership evidence for the score engine", () => {
  const adapted = adaptResumeFactsToEngineEvidence(validFacts());
  assert.equal(adapted.resumeEvidence.projects.projectCount, 1);
  assert.equal(adapted.resumeEvidence.projects.capabilities.deployment, true);
  assert.equal(adapted.resumeEvidence.internship.exists, true);
  assert.equal(adapted.resumeEvidence.hasGitHub, true);
  assert.equal(adapted.resumeEvidence.certifications.count, 1);
  assert.equal(adapted.leadershipItems[0].role, "Technical Team Coordinator");
});

test("resume extraction falls back to deterministic extraction when Gemini is unavailable", async () => {
  const result = await extractResumeFacts({ resumeText, targetRole: "Full-Stack Engineer" }, {
    geminiExtractor: async () => { throw new Error("simulated unavailable provider"); }
  });
  assert.equal(result.source, "deterministic_fallback");
  assert.equal(result.facts.schemaVersion, RESUME_FACTS_VERSION);
  assert.deepEqual(validateResumeFacts(result.facts, { resumeText }), { valid: true, errors: [] });
});

test("resume extraction keeps a valid Gemini result without changing its selected facts", async () => {
  const expected = validFacts();
  const result = await extractResumeFacts({ resumeText }, {
    geminiExtractor: async () => expected,
    fallbackExtractor: () => { throw new Error("fallback should not run"); }
  });
  assert.equal(result.source, "gemini");
  assert.deepEqual(result.facts, expected);
});

test("Gemini extraction makes one controlled repair attempt for invalid structured facts", async () => {
  const expected = validFacts();
  const prompts = [];
  const facts = await extractWithGemini({
    resumeText,
    generate: async ({ prompt }) => {
      prompts.push(prompt);
      return prompts.length === 1 ? { ...expected, projects: [{ ...expected.projects[0], evidence: { ...expected.projects[0].evidence, startOffset: 1 } }] } : expected;
    }
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /VALIDATION_ERRORS/);
  assert.deepEqual(facts, expected);
});
