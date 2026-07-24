const { randomUUID } = require("node:crypto");
const { computeReadiness } = require("../readinessEngine");
const { buildCanonicalEvidence } = require("./canonicalEvidenceService");
const { validateCanonicalEvidence } = require("./evidenceValidationService");
const { buildMentorReasoning } = require("./mentorReasoningService");
const { validateMentorAnalysisV2, SCHEMA_VERSION } = require("../../contracts/mentorAnalysis.v2");

const REASONING_MODEL_VERSION = "mentor-reasoning-1.0";

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const resumeEvidenceFromReadiness = (readiness) => ({
  internship: readiness.resumeFacts.internship,
  leadership: readiness.resumeFacts.leadership,
  research: readiness.resumeFacts.research,
  certifications: readiness.resumeFacts.certifications,
  certificationEntries: readiness.resumeEvidenceModel?.certificationEntries || [],
  activities: readiness.resumeEvidenceModel?.activities || {},
  competitiveProgramming: readiness.resumeFacts.competitiveProgramming,
  hackathons: readiness.resumeFacts.hackathons,
  openSource: readiness.resumeFacts.openSource,
  hasGitHub: readiness.resumeFacts.github,
  projects: { evaluatedProjects: readiness.resumeEvidenceModel?.projects || [] }
});

const createMentorAnalysisSnapshot = (profileData, options = {}) => {
  if (!profileData) throw new TypeError("Profile data is required to create a mentor analysis snapshot.");
  const readiness = options.readinessFacts || computeReadiness(profileData);
  const canonicalEvidence = buildCanonicalEvidence({
    profileData,
    resumeEvidence: resumeEvidenceFromReadiness(readiness),
    resumeProvided: readiness.extractedMetrics.resumeEvaluated
  });
  const evidenceValidation = validateCanonicalEvidence(canonicalEvidence);
  if (!evidenceValidation.valid) throw new Error(`Canonical evidence validation failed: ${evidenceValidation.errors.join("; ")}`);

  const context = {
    targetRole: profileData.targetRole,
    companyType: profileData.companyType,
    timelineMonths: readiness.extractedMetrics.timelineMonths,
    dailyStudyHours: readiness.extractedMetrics.dailyStudyHours,
    resumeProvided: readiness.extractedMetrics.resumeEvaluated
  };
  const reasoning = buildMentorReasoning({ canonicalEvidence, scoreLedger: readiness.scoreLedger, context });
  const snapshot = {
    metadata: {
      id: options.analysisId || randomUUID(),
      requestId: options.requestId || randomUUID(),
      createdAt: options.createdAt || new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      modelVersions: {
        scoring: readiness.scoreLedger.modelVersion,
        canonicalEvidence: canonicalEvidence.version,
        competencies: "1.0",
        reasoning: REASONING_MODEL_VERSION,
        language: "not_rendered"
      }
    },
    context,
    readiness: reasoning.readiness,
    strengths: reasoning.strengths,
    scoreDrivers: reasoning.scoreDrivers,
    scoreBlockers: reasoning.scoreBlockers,
    careerRisks: reasoning.careerRisks,
    priority: reasoning.priority,
    preparation: reasoning.preparation,
    internalTrace: {
      insightTrace: reasoning.traceIndex,
      canonicalEvidence,
      scoreLedger: readiness.scoreLedger
    }
  };

  const contractValidation = validateMentorAnalysisV2(snapshot);
  if (!contractValidation.valid) throw new Error(`Mentor analysis contract validation failed: ${contractValidation.errors.join("; ")}`);
  return deepFreeze(snapshot);
};

module.exports = { REASONING_MODEL_VERSION, createMentorAnalysisSnapshot };
