const { READINESS_LABELS } = require("../../configs/readinessLabels.v1");
const {
  PUBLIC_ANALYSIS_VERSION,
  findForbiddenPublicKeys
} = require("../../contracts/publicAnalysisV2");

const labelFor = (key) =>
  READINESS_LABELS.bands.find((band) => band.key === key)?.label || key;

const readinessExplanation = (snapshot) => {
  if (snapshot.context.studyStage === "early_stage") {
    return `This is an early-stage foundation assessment for ${snapshot.context.targetRole}; it reflects the evidence available today, not a final-placement prediction.`;
  }
  return `This ${labelFor(snapshot.readiness.labelKey).toLowerCase()} result reflects the role target, current preparation, academic record, and verified evidence available in the profile.`;
};

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
      explanation: readinessExplanation(snapshot),

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
      year: snapshot.context.year,
      studyStage: snapshot.context.studyStage,
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

module.exports = { createPublicAnalysisV2, readinessExplanation };
