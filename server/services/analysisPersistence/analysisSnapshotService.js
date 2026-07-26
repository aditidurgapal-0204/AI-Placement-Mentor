"use strict";

const { createHash } = require("node:crypto");

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const resumeHashFor = (profileData = {}) => {
  if (typeof profileData.resumeHash === "string" && profileData.resumeHash.trim()) return profileData.resumeHash;
  if (typeof profileData.resumeText === "string" && profileData.resumeText.trim()) return fingerprint({ resumeText: profileData.resumeText });
  return null;
};

const profileFingerprintFor = (profileData = {}) => fingerprint({
  branch: profileData.branch || null,
  year: profileData.year || null,
  cgpa: Number(profileData.cgpa) || null,
  companyType: profileData.companyType || null,
  targetRole: profileData.targetRole || null,
  skills: profileData.skills || {},
  timeline: profileData.timeline || {}
});

const inputFingerprintFor = ({ profileFingerprint, resumeHash, extractionVersion, scoringVersion, reasoningVersion, languageVersion }) => fingerprint({
  profileFingerprint,
  resumeHash,
  extractionVersion,
  scoringVersion,
  reasoningVersion,
  languageVersion
});

const readSnapshot = async (prisma, userId, inputFingerprint) => {
  const snapshot = await prisma.analysisSnapshot.findUnique({
    where: { userId_inputFingerprint: { userId, inputFingerprint } }
  });
  if (!snapshot || snapshot.status !== "COMPLETED") return null;
  return {
    analysis: snapshot.legacyAnalysis,
    analysisV2: snapshot.analysisV2,
    snapshotId: snapshot.id
  };
};

const readResumeExtraction = async (prisma, { userId, resumeHash, extractionVersions = [] }) => {
  if (!resumeHash) return null;

  for (const extractionVersion of extractionVersions) {
    const record = await prisma.resumeExtraction.findUnique({
      where: {
        userId_resumeHash_extractionVersion: {
          userId,
          resumeHash,
          extractionVersion
        }
      }
    });

    if (!record?.facts) continue;
    return {
      source: record.source,
      version: record.extractionVersion,
      model: record.model,
      facts: record.facts,
      warnings: record.validationReport?.warnings || []
    };
  }

  return null;
};

const saveResumeExtraction = async (prisma, { userId, resumeHash, extraction }) => {
  if (!resumeHash || !extraction?.facts) return null;
  const unique = {
    userId_resumeHash_extractionVersion: {
      userId,
      resumeHash,
      extractionVersion: extraction.version
    }
  };
  const existing = await prisma.resumeExtraction.findUnique({ where: unique });
  if (existing) return existing;
  try {
    return await prisma.resumeExtraction.create({
      data: {
        userId,
        resumeHash,
        extractionVersion: extraction.version,
        source: extraction.source,
        model: extraction.model,
        facts: extraction.facts,
        validationReport: { warnings: extraction.warnings || [] }
      }
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    return prisma.resumeExtraction.findUnique({ where: unique });
  }
};

const saveAnalysisSnapshot = async (prisma, {
  userId,
  profileFingerprint,
  inputFingerprint,
  extraction,
  resumeExtractionId,
  result
}) => {
  const data = {
    userId,
    resumeExtractionId: resumeExtractionId || null,
    profileFingerprint,
    inputFingerprint,
    scoringVersion: result.snapshot.metadata.modelVersions.scoring,
    reasoningVersion: result.snapshot.metadata.modelVersions.reasoning,
    languageVersion: `${result.languageVersion || "presentation-language-unknown"}:${result.language.source}`,
    scoreLedger: result.readinessFacts.scoreLedger,
    canonicalEvidence: result.snapshot.internalTrace.canonicalEvidence,
    mentorSnapshot: result.snapshot,
    analysisV2: result.analysisV2,
    legacyAnalysis: result.analysis
  };
  try {
    return await prisma.analysisSnapshot.create({ data });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    return prisma.analysisSnapshot.findUnique({
      where: { userId_inputFingerprint: { userId, inputFingerprint } }
    });
  }
};

module.exports = {
  fingerprint,
  resumeHashFor,
  profileFingerprintFor,
  inputFingerprintFor,
  readSnapshot,
  readResumeExtraction,
  saveResumeExtraction,
  saveAnalysisSnapshot
};
