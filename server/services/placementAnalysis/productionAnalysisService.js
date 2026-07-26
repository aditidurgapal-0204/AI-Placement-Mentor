const { randomUUID } = require("node:crypto");
const { computeReadiness } = require("../readinessEngine");
const geminiService = require("../geminiService");
const { extractResumeFacts } = require("../resumeExtraction/resumeExtractionService");
const { createMentorAnalysisSnapshot } = require("./analysisOrchestrator");
const { generateAnalysisLanguage } = require("./analysisLanguageService");
const { createPublicAnalysisV2 } = require("./publicAnalysisV2Adapter");

const DEFAULT_LANGUAGE_TIMEOUT_MS = 15000;

// The legacy shape remains available for the current client, but it is now
// projected from the same validated V2 result. This prevents two independent
// language calls from giving contradictory dashboard content.
const legacyAnalysisFromV2 = (analysisV2) => ({
  readinessScore: analysisV2.readiness.score,
  diagnosis: analysisV2.diagnosis,
  strengths: analysisV2.strengths.map(({ text }) => text),
  weaknesses: [...analysisV2.scoreBlockers, ...analysisV2.careerRisks].map(({ text }) => text),
  strengthFacts: []
});

const analyzePlacementProfileV2 = async (profileData, options = {}) => {
  const startedAt = Date.now();
  const requestId = options.requestId || randomUUID();
  const analysisId = options.analysisId || randomUUID();
  const dependencies = options.dependencies || {};
  const calculateReadiness = dependencies.computeReadiness || computeReadiness;
  const generateLanguage = dependencies.generateLanguage || geminiService.generatePresentationLanguage;
  const extractFacts = dependencies.extractResumeFacts || extractResumeFacts;
  const extraction = await extractFacts(profileData, { requestId, generate: dependencies.generateExtraction });
  const readinessFacts = calculateReadiness(profileData, {
    resumeFacts: extraction.facts,
    resumeExtractionSource: extraction.source,
    resumeExtractionVersion: extraction.version
  });
  const snapshot = createMentorAnalysisSnapshot(profileData, {
    readinessFacts,
    requestId,
    analysisId,
    createdAt: options.createdAt
  });

  const language = await generateAnalysisLanguage(
    snapshot,
    ({ prompt }) => generateLanguage(prompt, { requestId, analysisId }),
    { timeoutMs: options.languageTimeoutMs ?? DEFAULT_LANGUAGE_TIMEOUT_MS }
  );
  const analysisV2 = createPublicAnalysisV2(snapshot, language);
  const analysis = dependencies.analyzeLegacy
    ? await dependencies.analyzeLegacy(profileData, { requestId, engineFacts: readinessFacts })
    : legacyAnalysisFromV2(analysisV2);

  console.info("Placement mentor V2 analysis completed", {
    analysisId,
    requestId,
    contractVersion: analysisV2.contractVersion,
    reasoningVersion: snapshot.metadata.modelVersions.reasoning,
    scoreModelVersion: snapshot.metadata.modelVersions.scoring,
    languageSource: language.source,
    groundingStatus: language.groundingErrors?.length ? "rejected_or_unavailable" : "accepted",
    groundingFailureCategory: language.failureCategory || null,
    fallbackUsed: language.source === "deterministic_fallback",
    durationMs: Date.now() - startedAt
  });

  if (options.includeArtifacts) {
    return { analysis, analysisV2, snapshot, readinessFacts, language, extraction };
  }

  return { analysis, analysisV2 };
};

module.exports = { DEFAULT_LANGUAGE_TIMEOUT_MS, analyzePlacementProfileV2, legacyAnalysisFromV2 };
