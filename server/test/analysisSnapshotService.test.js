"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resumeHashFor,
  profileFingerprintFor,
  inputFingerprintFor,
  readSnapshot,
  readResumeExtraction
} = require("../services/analysisPersistence/analysisSnapshotService");

const profile = {
  branch: "Computer Science",
  year: "2027",
  cgpa: 8.2,
  companyType: "Product Based",
  targetRole: "Backend Developer",
  skills: { dsa: "Intermediate", dbms: "Intermediate" },
  timeline: { preparationTimelineMonths: 6, dailyStudyHours: 3 },
  resumeText: "PROJECTS\nService Platform"
};

const fingerprintInput = (profileFingerprint, resumeHash, extractionVersion = "resume-facts-1.0:gemini") => ({
  profileFingerprint,
  resumeHash,
  extractionVersion,
  scoringVersion: "deterministic-readiness-2.1",
  reasoningVersion: "mentor-reasoning-1.1",
  languageVersion: "presentation-language-2.1"
});

test("snapshot fingerprints are stable for equivalent profile content", () => {
  const firstProfileFingerprint = profileFingerprintFor(profile);
  const secondProfileFingerprint = profileFingerprintFor({ ...profile, skills: { dbms: "Intermediate", dsa: "Intermediate" } });
  const resumeHash = resumeHashFor(profile);
  assert.equal(firstProfileFingerprint, secondProfileFingerprint);
  assert.equal(
    inputFingerprintFor(fingerprintInput(firstProfileFingerprint, resumeHash)),
    inputFingerprintFor(fingerprintInput(secondProfileFingerprint, resumeHash))
  );
});

test("changing a score-affecting input produces a new analysis fingerprint", () => {
  const resumeHash = resumeHashFor(profile);
  const first = inputFingerprintFor(fingerprintInput(profileFingerprintFor(profile), resumeHash));
  const changed = inputFingerprintFor(fingerprintInput(profileFingerprintFor({
    ...profile,
    targetRole: "Machine Learning Engineer"
  }), resumeHash));
  assert.notEqual(first, changed);
});

test("changing extraction or scoring versions produces a new analysis fingerprint", () => {
  const profileFingerprint = profileFingerprintFor(profile);
  const resumeHash = resumeHashFor(profile);
  const current = inputFingerprintFor(fingerprintInput(profileFingerprint, resumeHash));
  const changedExtraction = inputFingerprintFor(fingerprintInput(profileFingerprint, resumeHash, "resume-facts-2.0:gemini"));
  const changedScoring = inputFingerprintFor({ ...fingerprintInput(profileFingerprint, resumeHash), scoringVersion: "deterministic-readiness-3.0" });
  assert.notEqual(current, changedExtraction);
  assert.notEqual(current, changedScoring);
});

test("completed snapshots are reusable while incomplete snapshots are not", async () => {
  const prisma = {
    analysisSnapshot: {
      findUnique: async () => ({ id: "completed", status: "COMPLETED", legacyAnalysis: { readinessScore: 42 }, analysisV2: { readiness: { score: 42 } } })
    }
  };
  const reusable = await readSnapshot(prisma, "user-1", "input-1");
  assert.equal(reusable.snapshotId, "completed");
  assert.equal(reusable.analysis.readinessScore, 42);

  prisma.analysisSnapshot.findUnique = async () => ({ id: "failed", status: "FAILED", legacyAnalysis: {}, analysisV2: {} });
  assert.equal(await readSnapshot(prisma, "user-1", "input-1"), null);
});

test("validated resume facts are reusable across analyses of the same uploaded resume", async () => {
  const calls = [];
  const prisma = {
    resumeExtraction: {
      findUnique: async ({ where }) => {
        calls.push(where.userId_resumeHash_extractionVersion.extractionVersion);
        if (calls.length === 1) return null;
        return {
          source: "deterministic_fallback",
          extractionVersion: "resume-facts-1.0:deterministic-fallback",
          model: null,
          facts: { version: "1.0", projects: [] },
          validationReport: { warnings: ["provider_unavailable"] }
        };
      }
    }
  };

  const extraction = await readResumeExtraction(prisma, {
    userId: "user-1",
    resumeHash: "resume-hash",
    extractionVersions: ["resume-facts-1.0:gemini", "resume-facts-1.0:deterministic-fallback"]
  });

  assert.deepEqual(calls, ["resume-facts-1.0:gemini", "resume-facts-1.0:deterministic-fallback"]);
  assert.equal(extraction.source, "deterministic_fallback");
  assert.deepEqual(extraction.warnings, ["provider_unavailable"]);
});
