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
  return `Your profile shows ${pretty(item.type)}.`;
};

const renderBlocker = (item) => {
  const facts = item.facts || {};
  if (item.type === "skill_gap") {
    return `${pretty(facts.skill)} is currently at ${facts.currentLevel} level and needs to reach ${facts.expectedLevel} level.`;
  }
  if (item.type === "score_penalty" && facts.category === "target_alignment") {
    return `The selected company target currently requires stronger preparation than the profile demonstrates.`;
  }
  return `${pretty(facts.category || item.type)} is a meaningful current readiness gap.`;
};

const renderRisk = (item) => {
  if (item.type === "professional_exposure_gap") return "The profile does not yet show internship or equivalent real-world engineering experience.";
  if (item.type === "cloud_experience_gap") return "The profile does not yet show cloud experience.";
  if (item.type === "scalability_experience_gap") return "The profile does not yet show scalability or system-design experience.";
  if (item.type === "deployment_gap") return "The profile does not yet show deployment evidence.";
  return `The profile does not yet show ${pretty(item.facts?.capability || item.type)}.`;
};

const renderPriority = (priority) => {
  const facts = priority.facts?.targetFacts || {};
  const type = priority.facts?.targetInsightType;
  if (type === "skill_gap") return `Prioritize improving ${pretty(facts.skill)} from ${facts.currentLevel} to ${facts.expectedLevel} level.`;
  if (type === "professional_exposure_gap") return "Prioritize gaining one reviewable real-world engineering experience.";
  if (type === "cloud_experience_gap") return "Prioritize adding cloud experience to one existing project.";
  if (type === "scalability_experience_gap") return "Prioritize documenting scalability and system decisions in one deployed project.";
  return "Prioritize the highest-impact gap identified in the analysis.";
};

const renderDeterministicAnalysis = (input) => {
  const strongest = input.strengths[0];
  const mainGap = input.scoreBlockers[0] || input.careerRisks[0];
  const strength = strongest ? renderStrength(strongest) : "The profile has a usable starting foundation.";
  const gap = mainGap
    ? (input.scoreBlockers.includes(mainGap) ? renderBlocker(mainGap) : renderRisk(mainGap))
    : "The next step is to make the profile easier for recruiters to evaluate.";
  const preparation = input.preparation?.facts || {};
  const capacity = Number.isFinite(preparation.timelineMonths) && Number.isFinite(preparation.dailyStudyHours)
    ? `With ${preparation.timelineMonths} months and ${preparation.dailyStudyHours} study hours per day, the preparation capacity is ${input.preparation.feasibility}.`
    : "";

  return {
    analysisId: input.analysisId,
    diagnosis: [
      `A readiness score of ${input.readiness.score} places the profile in the ${pretty(input.readiness.labelKey)} stage for ${input.context.targetRole}.`,
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
