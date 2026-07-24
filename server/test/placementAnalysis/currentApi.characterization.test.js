const assert = require("node:assert/strict");
const test = require("node:test");

const prismaPath = require.resolve("../../lib/prisma");
const geminiPath = require.resolve("../../services/geminiService");
const productionPath = require.resolve("../../services/placementAnalysis/productionAnalysisService");
const controllerPath = require.resolve("../../controllers/aiController");

const placementProfile = {
  id: "profile-test",
  branch: "Computer Science",
  year: "2027",
  cgpa: "8.2",
  companyType: "Product Based",
  targetRole: "Software Development Engineer",
  dsa: "Intermediate",
  dbms: "Intermediate",
  os: "Intermediate",
  networks: "Beginner",
  aptitude: "Intermediate",
  communication: "Strong",
  preparationTimelineMonths: 6,
  dailyStudyHours: 4,
  resumeUrl: null,
  resumeText: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z")
};

test("current analysis controller response shape remains characterized", async () => {
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { user: { findUnique: async () => ({ id: "user-test", placementProfile }) } }
  };
  require.cache[geminiPath] = {
    id: geminiPath,
    filename: geminiPath,
    loaded: true,
    exports: {
      analyzePlacementProfile: async () => ({
        readinessScore: 41,
        diagnosis: "Characterized diagnosis",
        strengths: ["Characterized strength"],
        strengthFacts: [],
        weaknesses: ["Characterized weakness"]
      })
    }
  };
  require.cache[productionPath] = {
    id: productionPath,
    filename: productionPath,
    loaded: true,
    exports: {
      analyzePlacementProfileV2: async () => ({
        analysis: {
          readinessScore: 41,
          diagnosis: "Characterized diagnosis",
          strengths: ["Characterized strength"],
          strengthFacts: [],
          weaknesses: ["Characterized weakness"]
        },
        analysisV2: { contractVersion: "2.0", requestId: "request-test" }
      })
    }
  };
  delete require.cache[controllerPath];
  const { generateAnalysis } = require(controllerPath);

  let statusCode;
  let body;
  const req = {
    user: { userId: "user-test" },
    get: () => "request-test"
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return value; }
  };

  await generateAnalysis(req, res);

  assert.equal(statusCode, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    "analysis", "analysisV2", "profileData", "profileFound", "resumeTextAvailable",
    "resumeUploaded", "success", "userFound"
  ]);
  assert.deepEqual(Object.keys(body.analysis).sort(), [
    "diagnosis", "readinessScore", "strengthFacts", "strengths", "weaknesses"
  ]);
  assert.deepEqual(body.analysisV2, { contractVersion: "2.0", requestId: "request-test" });
  assert.deepEqual(Object.keys(body.profileData).sort(), [
    "branch", "cgpa", "companyType", "resumeAvailable", "skills", "targetRole", "timeline", "year"
  ]);
  assert.equal(Object.hasOwn(body.profileData, "resumeText"), false);
  assert.equal(body.resumeUploaded, false);
  assert.equal(body.resumeTextAvailable, false);
});
