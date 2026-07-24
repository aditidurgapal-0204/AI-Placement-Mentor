const assert = require("node:assert/strict");
const test = require("node:test");

const sdkPath = require.resolve("@google/generative-ai");
const readinessPath = require.resolve("../services/readinessEngine");
const servicePath = require.resolve("../services/geminiService");
require(sdkPath);

const engineFacts = {
  readinessScore: 71,
  factualStrengths: ["Strong backend foundations"],
  strengthFacts: [{ type: "demonstratedTechnicalCapability", focus: "backend", evidenceStrength: { supportingProjectCount: 1 } }],
  weaknessFacts: [{ id: "gap-productionReadiness", type: "productionReadiness", blocks: "strongerRecruiterConfidence", readinessImpact: 8 }],
  scoreExplanation: { score: 71, strongestDrivers: [], highestImpactBlockers: [], firstPriority: "gap-productionReadiness" },
  profileWeaknesses: ["Beginner-level Operating Systems"],
  resumeWeaknesses: ["cloudMissing"],
  extractedMetrics: { timelineMonths: 4, dailyStudyHours: 2, resumeEvaluated: true },
  resumeFacts: {
    internship: { exists: true },
    leadership: { exists: false },
    research: { exists: false },
    certifications: [],
    github: true,
    projects: { count: 1, summaries: [] }
  }
};

const profileData = {
  targetRole: "Backend Engineer",
  companyType: "Product",
  cgpa: "8.2",
  skills: {},
  timeline: { preparationTimelineMonths: 4, dailyStudyHours: 2 }
};

const validDiagnosis = "Your backend project gives you a practical starting point for the role you selected. The strongest part of your profile is the implementation work that shows you can build a working service. Production experience is still the main limitation because recruiters need clearer proof that your work is reliable beyond coursework. Improve one project with deployment, testing, and documentation first, while continuing your regular interview preparation.";
const generatedStrengths = ["Built backend services using Java across one project."];
const generatedWeaknesses = ["Build stronger cloud deployment evidence for backend roles."];

const response = ({
  finishReason = "STOP",
  text = JSON.stringify({ diagnosis: validDiagnosis, strengths: generatedStrengths, weaknesses: generatedWeaknesses })
} = {}) => ({
  candidates: [{ finishReason }],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 130,
    thoughtsTokenCount: 0,
    totalTokenCount: 230
  },
  text: () => text
});

const loadService = (outcomes) => {
  let callCount = 0;
  let capturedModelParams;
  let capturedGenerateRequest;

  class MockGoogleGenerativeAI {
    getGenerativeModel(modelParams) {
      capturedModelParams = modelParams;
      return {
        generateContent: async (request) => {
          capturedGenerateRequest = request;
          const outcome = outcomes[Math.min(callCount, outcomes.length - 1)];
          callCount += 1;
          if (outcome instanceof Error) throw outcome;
          return { response: outcome };
        }
      };
    }
  }

  require.cache[sdkPath].exports.GoogleGenerativeAI = MockGoogleGenerativeAI;
  require.cache[readinessPath] = {
    id: readinessPath,
    filename: readinessPath,
    loaded: true,
    exports: { computeReadiness: () => engineFacts }
  };
  delete require.cache[servicePath];
  process.env.GEMINI_API_KEY = "test-key";

  const service = require(servicePath);
  return {
    service,
    getCallCount: () => callCount,
    getModelParams: () => capturedModelParams,
    getGenerateRequest: () => capturedGenerateRequest
  };
};

test("returns Gemini strength text together with structured fallback facts", async () => {
  const harness = loadService([response()]);
  const result = await harness.service.analyzePlacementProfile(profileData);

  assert.equal(harness.getCallCount(), 1);
  assert.deepEqual(Object.keys(result).sort(), ["diagnosis", "readinessScore", "strengthFacts", "strengths", "weaknesses"]);
  assert.equal(result.diagnosis, validDiagnosis);
  assert.equal(result.readinessScore, 71);
  assert.deepEqual(harness.getModelParams().generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(harness.getModelParams().generationConfig.responseMimeType, "application/json");
  assert.deepEqual(result.strengths, generatedStrengths);
  assert.deepEqual(result.weaknesses, generatedWeaknesses);
  assert.deepEqual(result.strengthFacts, engineFacts.strengthFacts);
  const prompt = harness.getGenerateRequest().contents[0].parts[0].text;
  assert.match(prompt, /"dailyStudyHours": 2/);
  assert.match(prompt, /"type": "demonstratedTechnicalCapability"/);
  assert.doesNotMatch(prompt, /Java|projectSummaries|detectedTechnologies|topEvidence/);
});

test("two intended analyses make exactly one Gemini call each", async () => {
  const harness = loadService([response(), response()]);
  await Promise.all([
    harness.service.analyzePlacementProfile(profileData),
    harness.service.analyzePlacementProfile(profileData)
  ]);
  assert.equal(harness.getCallCount(), 2);
});

test("retries once only for MAX_TOKENS", async () => {
  const harness = loadService([
    response({ finishReason: "MAX_TOKENS", text: "truncated" }),
    response()
  ]);
  const result = await harness.service.analyzePlacementProfile(profileData);
  assert.equal(harness.getCallCount(), 2);
  assert.equal(result.diagnosis, validDiagnosis);
});

for (const [name, outcome] of [
  ["empty response", response({ text: "" })],
  ["invalid response", response({ text: `{\"diagnosis\":\"${validDiagnosis}\"}` })],
  ["Gemini API error", new Error("network unavailable")]
]) {
  test(`${name} uses the deterministic fallback without retrying`, async () => {
    const harness = loadService([outcome]);
    const result = await harness.service.analyzePlacementProfile(profileData);
    assert.equal(harness.getCallCount(), 1);
    assert.match(result.diagnosis, /^Your readiness for Backend Engineer is based on/);
    assert.ok(result.diagnosis.split(/\s+/).length >= 45);
    assert.ok(result.diagnosis.split(/\s+/).length <= 120);
    assert.ok((result.diagnosis.match(/[.!?](?:\s|$)/g) || []).length >= 3);
  });
}

test("a second MAX_TOKENS response uses the deterministic fallback", async () => {
  const truncated = response({ finishReason: "MAX_TOKENS", text: "truncated" });
  const harness = loadService([truncated, truncated]);
  const result = await harness.service.analyzePlacementProfile(profileData);
  assert.equal(harness.getCallCount(), 2);
  assert.match(result.diagnosis, /^Your readiness for Backend Engineer is based on/);
});
