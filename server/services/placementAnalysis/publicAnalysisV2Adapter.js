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

const humanize = (value) => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const insightSubject = (item) => {
  const facts = item?.facts || {};
  if (facts.skill) return humanize(facts.skill);
  if (facts.category) return humanize(facts.category);
  if (facts.capability) return humanize(facts.capability);
  if (facts.project?.projectType) return humanize(facts.project.projectType);
  return humanize(item?.type || "profile evidence");
};

const createReadinessExplanation = (snapshot) => {
  const label = labelFor(snapshot.readiness.labelKey);
  const targetRole = snapshot.context.targetRole || "the selected role";
  const companyType = snapshot.context.companyType || "the selected company type";
  const strongestDriver = snapshot.scoreDrivers?.[0] || snapshot.strengths?.[0] || null;
  const biggestBlocker = snapshot.scoreBlockers?.[0] || null;
  const mainRisk = snapshot.careerRisks?.[0] || null;

  const parts = [
    `This ${label.toLowerCase()} score reflects the verified profile and resume evidence available for ${targetRole} at ${companyType}.`
  ];

  if (strongestDriver) {
    parts.push(`${insightSubject(strongestDriver)} is currently helping the readiness result.`);
  }

  if (biggestBlocker) {
    parts.push(`${insightSubject(biggestBlocker)} is the clearest score-limiting area to improve next.`);
  } else if (mainRisk) {
    parts.push(`${insightSubject(mainRisk)} is an important career risk to address even though it is not treated as a current score penalty.`);
  }

  if (snapshot.context.resumeProvided === false) {
    parts.push("Because no resume was assessed, resume-based proof such as projects, internships, portfolio evidence and leadership can only be evaluated after it is provided.");
  }

  return parts.join(" ");
};

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
      explanation: createReadinessExplanation(snapshot),

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
