const { randomUUID } = require("node:crypto");
const { computeReadiness } = require("../readinessEngine");
const geminiService = require("../geminiService");
const { createMentorAnalysisSnapshot } = require("./analysisOrchestrator");
const { generateAnalysisLanguage } = require("./analysisLanguageService");
const { createPublicAnalysisV2 } = require("./publicAnalysisV2Adapter");

const DEFAULT_LANGUAGE_TIMEOUT_MS = 15000;

const analyzePlacementProfileV2 = async (profileData, options = {}) => {
  const startedAt = Date.now();
  const requestId = options.requestId || randomUUID();
  const analysisId = options.analysisId || randomUUID();
  const dependencies = options.dependencies || {};
  const calculateReadiness = dependencies.computeReadiness || computeReadiness;
  const renderLegacy = dependencies.analyzeLegacy || geminiService.analyzePlacementProfile;
  const generateLanguage = dependencies.generateLanguage || geminiService.generatePresentationLanguage;
  const readinessFacts = calculateReadiness(profileData);
  const snapshot = createMentorAnalysisSnapshot(profileData, {
    readinessFacts,
    requestId,
    analysisId,
    createdAt: options.createdAt
  });

  const [analysis, language] = await Promise.all([
    renderLegacy(profileData, { requestId, engineFacts: readinessFacts }),
    generateAnalysisLanguage(
      snapshot,
      ({ prompt }) => generateLanguage(prompt, { requestId, analysisId }),
      { timeoutMs: options.languageTimeoutMs ?? DEFAULT_LANGUAGE_TIMEOUT_MS }
    )
  ]);
  const analysisV2 = createPublicAnalysisV2(snapshot, language);

  console.info("Placement mentor V2 analysis completed", {
    analysisId,
    requestId,
    contractVersion: analysisV2.contractVersion,
    reasoningVersion: snapshot.metadata.modelVersions.reasoning,
    scoreModelVersion: snapshot.metadata.modelVersions.scoring,
    languageSource: language.source,
    groundingStatus: language.groundingErrors?.length
      ? (language.groundingBypassed ? "bypassed" : "rejected_or_unavailable")
      : "accepted",
    groundingFailureCategory: language.failureCategory || null,
    groundingBypassed: language.groundingBypassed === true,
    fallbackUsed: language.source === "deterministic_fallback",
    durationMs: Date.now() - startedAt
  });

  return { analysis, analysisV2 };
};

module.exports = { DEFAULT_LANGUAGE_TIMEOUT_MS, analyzePlacementProfileV2 };
