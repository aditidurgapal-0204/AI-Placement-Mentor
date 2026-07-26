const pretty = (value) => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const renderStrength = (item) => {
  const facts = item.facts || {};
  if (item.type === "project_strength") {
    const project = facts.project || {};
    const tech = (project.technologies || []).slice(0, 3);
    return `${project.name || "A project"} demonstrates ${pretty(facts.category || "technical execution")}${tech.length ? ` using ${tech.join(", ")}` : ""}.`;
  }
  if (item.type === "academic_strength") {
    return `A CGPA of ${facts.cgpa} shows consistent academic performance.`;
  }
  if (item.type === "leadership_strength") {
    return `${facts.role || pretty(facts.activity || "Leadership experience")}${facts.organization ? ` at ${facts.organization}` : ""} demonstrates responsibility beyond coursework.`;
  }
  if (item.type === "profile_skill_strength") {
    return `Your ${pretty(facts.skill)} self-assessment is at ${String(facts.level || "strong").toLowerCase()} level for the selected role.`;
  }
  return `Your profile shows ${pretty(item.type)}.`;
};

const renderBlocker = (item) => {
  const facts = item.facts || {};
  if (item.type === "skill_gap") {
    return `Practice ${pretty(facts.skill)} to progress from ${facts.currentLevel} to ${facts.expectedLevel} level.`;
  }
  if (item.type === "score_penalty" && facts.category === "target_alignment") {
    return "Strengthen the core preparation expected by the selected company target.";
  }
  return `Improve ${pretty(facts.category || item.type)} to close a meaningful current readiness gap.`;
};

const renderRisk = (item) => {
  if (item.type === "professional_exposure_gap") return "Gain one reviewable engineering experience to demonstrate real-world collaboration.";
  if (item.type === "cloud_experience_gap") return "Improve one project with cloud deployment to demonstrate cloud experience.";
  if (item.type === "scalability_experience_gap") return "Improve one project by documenting scalability and system-design decisions.";
  if (item.type === "deployment_gap") return "Improve one project by deploying it and adding a live link or clear deployment evidence.";
  if (item.type === "portfolio_verifiability_gap") return "Publish a code portfolio that makes one strong project easy to review.";
  return `Improve evidence for ${pretty(item.facts?.capability || item.type)} in the profile.`;
};

const renderPriority = (priority) => {
  const facts = priority.facts?.targetFacts || {};
  const type = priority.facts?.targetInsightType;
  if (type === "skill_gap") return `Prioritize improving ${pretty(facts.skill)} from ${facts.currentLevel} to ${facts.expectedLevel} level.`;
  if (type === "professional_exposure_gap") return "Prioritize gaining one reviewable real-world engineering experience.";
  if (type === "cloud_experience_gap") return "Prioritize adding cloud experience to one existing project.";
  if (type === "scalability_experience_gap") return "Prioritize documenting scalability and system decisions in one deployed project.";
  if (type === "score_gap" || type === "score_penalty") {
    return `Focus on improving ${pretty(facts.category || "the highest-impact readiness gap")} for the selected role.`;
  }
  return "Focus on improving the highest-impact gap identified in the analysis.";
};

const renderDeterministicAnalysis = (input) => {
  const strongest = input.strengths[0];
  const mainGap = input.scoreBlockers[0] || input.careerRisks[0];
  const strength = strongest ? renderStrength(strongest) : null;
  const gap = mainGap
    ? (input.scoreBlockers.includes(mainGap) ? renderBlocker(mainGap) : renderRisk(mainGap))
    : "The next step is to make the profile easier for recruiters to evaluate.";
  const preparation = input.diagnosisContext?.preparationContext || {};
  const capacity = Number.isFinite(preparation.timelineMonths) && Number.isFinite(preparation.dailyStudyHours)
    ? `With ${preparation.timelineMonths} months and ${preparation.dailyStudyHours} study hours per day, the preparation capacity is ${preparation.feasibility || "available"}.`
    : "";

  return {
    analysisId: input.analysisId,
    diagnosis: [
      input.context.studyStage === "early_stage"
        ? `This is an early-stage foundation assessment for ${input.context.targetRole}, not a final-placement prediction.`
        : `A readiness score of ${input.readiness.score} places the profile in the ${pretty(input.readiness.labelKey)} stage for ${input.context.targetRole}.`,
      strength,
      gap,
      renderPriority(input.priority),
      capacity
    ].filter(Boolean).join(" "),
    strengths: input.strengths.map((item) => ({ insightId: item.id, text: renderStrength(item) })),
    scoreBlockers: input.scoreBlockers.map((item) => ({ insightId: item.id, text: renderBlocker(item) })),
    careerRisks: input.careerRisks.map((item) => ({ insightId: item.id, text: renderRisk(item) })),
    priority: { insightId: input.priority.id, text: renderPriority(input.priority) }
  };
};

module.exports = { renderDeterministicAnalysis };
