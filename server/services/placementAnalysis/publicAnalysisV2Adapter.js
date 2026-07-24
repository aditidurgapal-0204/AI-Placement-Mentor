const { READINESS_LABELS } = require("../../configs/readinessLabels.v1");
const {
  PUBLIC_ANALYSIS_VERSION,
  findForbiddenPublicKeys
} = require("../../contracts/publicAnalysisV2");

const labelFor = (key) =>
  READINESS_LABELS.bands.find((band) => band.key === key)?.label || key;

const publicLanguageInsight = (item) => ({
  id: item.insightId,
  text: item.text
});

const createPublicAnalysisV2 = (snapshot, language) => {
  if (!snapshot?.metadata?.id) {
    throw new Error("A valid mentor analysis snapshot is required.");
  }

  if (!language?.output) {
    throw new Error("Rendered analysis language is required.");
  }

  const output = language.output;

  const response = {
    analysisId: snapshot.metadata.id,
    requestId: snapshot.metadata.requestId,
    createdAt: snapshot.metadata.createdAt,
    contractVersion: PUBLIC_ANALYSIS_VERSION,
    languageSource: language.source,

    readiness: {
      score: snapshot.readiness.score,
      label: labelFor(snapshot.readiness.labelKey),
      labelKey: snapshot.readiness.labelKey,

      nextLevel: {
        label: labelFor(snapshot.readiness.nextLabelKey),
        labelKey: snapshot.readiness.nextLabelKey,
        pointsRequired: snapshot.readiness.pointsToNextLevel
      }
    },

    diagnosis: output.diagnosis,

    strengths: output.strengths.map(publicLanguageInsight),

    scoreBlockers: output.scoreBlockers.map(publicLanguageInsight),

    careerRisks: output.careerRisks.map(publicLanguageInsight),

    firstPriority: {
      id: output.priority.insightId,
      text: output.priority.text,
      preparationFeasibility: snapshot.priority.preparationFeasibility
    },

    preparation: {
      feasibility: snapshot.preparation.feasibility,
      improvementPotential: snapshot.preparation.improvementPotential
    },

    context: {
      targetRole: snapshot.context.targetRole,
      companyType: snapshot.context.companyType,
      timelineMonths: snapshot.context.timelineMonths,
      dailyStudyHours: snapshot.context.dailyStudyHours,
      resumeProvided: snapshot.context.resumeProvided
    }
  };

  const forbidden = findForbiddenPublicKeys(response);

  if (forbidden.length) {
    throw new Error(
      `Public analysis V2 contains forbidden fields: ${forbidden.join("; ")}`
    );
  }

  return response;
};

module.exports = { createPublicAnalysisV2 };