const sentence = (value) => String(value || "").trim().replace(/[.!?]+$/, "");

const renderInsight = (insight) => ({
  insightId: insight.id,
  text: `${sentence(insight.conclusion)}. ${sentence(insight.roleConnection)}.`
});

const renderDiagnosis = (input) => {
  const strongest = input.strengths[0];
  const mainGap = input.scoreBlockers[0] || input.careerRisks[0];
  const advantage = strongest
    ? sentence(strongest.conclusion)
    : "Your current profile gives you a starting point for focused preparation";
  const limitation = mainGap
    ? sentence(mainGap.conclusion)
    : "Your next improvement should make your work easier for recruiters to evaluate";

  return [
    `For ${input.context.targetRole} roles at ${input.context.companyType} companies, ${sentence(input.readiness.meaning).toLowerCase()}.`,
    `${advantage}.`,
    `${limitation}.`,
    `Start with the First Priority below; ${sentence(input.priority.whyFirst).toLowerCase()}.`
  ].join(" ");
};

const renderDeterministicAnalysis = (input) => ({
  analysisId: input.analysisId,
  diagnosis: renderDiagnosis(input),
  strengths: input.strengths.map(renderInsight),
  scoreBlockers: input.scoreBlockers.map(renderInsight),
  careerRisks: input.careerRisks.map(renderInsight),
  priority: {
    insightId: input.priority.id,
    text: `${sentence(input.priority.objective)}. ${sentence(input.priority.whyFirst)}.`
  }
});

module.exports = { renderDeterministicAnalysis };
