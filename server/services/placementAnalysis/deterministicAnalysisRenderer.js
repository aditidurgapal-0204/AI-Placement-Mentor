const pretty = (value) => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const list = (items = []) => items.filter(Boolean).slice(0, 3).join(", ");

const renderStrength = (item) => {
  const facts = item.facts || {};
  const evidence = item.evidence || {};
  const project = facts.project || evidence.projectExamples?.[0] || {};
  if (item.type === "technical_capability") {
    const tech = list(project.technologies || []);
    return `${project.name || "Your project work"} demonstrates ${pretty(facts.category || "technical execution")}${tech ? ` using ${tech}` : ""} for ${facts.targetRole || "the selected role"}.`;
  }
  if (item.type === "academic_strength") {
    return `A CGPA of ${facts.cgpa} shows consistent academic performance.`;
  }
  if (item.type === "profile_skill_strength") {
    const skills = evidence.skillFacts || facts.skills || [];
    return `${list(skills.map(({ skill, level }) => `${pretty(skill)} at ${level} level`))} supports your preparation for ${facts.targetRole || "the selected role"}.`;
  }
  if (item.type === "professional_evidence") {
    return `Your resume provides reviewable evidence of ${list((facts.evidenceTypes || []).map(pretty))}.`;
  }
  if (item.type === "preparation_capacity_strength") {
    return `Your ${facts.timelineMonths}-month plan with ${facts.dailyStudyHours} daily study hours gives you useful preparation capacity.`;
  }
  if (item.type === "leadership_strength") {
    return `${facts.role || pretty(facts.activity || "Leadership experience")}${facts.organization ? ` at ${facts.organization}` : ""} demonstrates responsibility beyond coursework.`;
  }
  return `Your profile shows ${pretty(item.type)}.`;
};

const renderBlocker = (item) => {
  const facts = item.facts || {};
  if (item.type === "skill_gap") {
    return `Improve ${pretty(facts.skill)} from ${facts.currentLevel} toward ${facts.expectedLevel} level for ${facts.targetRole || "the selected role"} screening.`;
  }
  if (item.type === "score_penalty" && facts.category === "target_alignment") {
    return `Strengthen preparation for the selected company target because it currently expects more evidence than the profile shows.`;
  }
  return `Improve ${pretty(facts.category || item.type)} because it is a meaningful current readiness gap.`;
};

const renderRisk = (item) => {
  if (item.type === "professional_exposure_gap") return "Gain internship or equivalent real-world engineering experience so recruiters can judge practical responsibility.";
  if (item.type === "cloud_experience_gap") return "Build cloud experience into one project so production exposure is easier to verify.";
  if (item.type === "scalability_experience_gap") return "Strengthen one project with scalability or system-design decisions so technical depth is easier to evaluate.";
  if (item.type === "deployment_gap") return "Publish one working project so recruiters can review the outcome directly.";
  if (item.type === "technical_evidence_gap") return "Complete one role-relevant technical project so your ability is easier to assess.";
  if (item.type === "portfolio_verifiability_gap") return "Publish a clear code portfolio so your technical work is easier to verify.";
  return `Improve ${pretty(item.facts?.capability || item.type)} so the profile becomes easier to evaluate.`;
};

const renderPriority = (priority) => {
  const facts = priority.facts?.targetFacts || {};
  const type = priority.facts?.targetInsightType;
  if (type === "skill_gap") return `Prioritize improving ${pretty(facts.skill)} from ${facts.currentLevel} to ${facts.expectedLevel} level.`;
  if (type === "score_penalty" && facts.category === "target_alignment") {
    return `Focus first on bringing stronger evidence for ${facts.companyType || "the selected company target"} expectations.`;
  }
  if (type === "score_gap") {
    return `Focus first on improving ${pretty(facts.category)} because it is limiting the current readiness score.`;
  }
  if (type === "professional_exposure_gap") return "Prioritize gaining one reviewable real-world engineering experience.";
  if (type === "cloud_experience_gap") return "Prioritize adding cloud experience to one existing project.";
  if (type === "scalability_experience_gap") return "Prioritize documenting scalability and system decisions in one deployed project.";
  if (type === "deployment_gap") return "Prioritize publishing one working project that recruiters can review directly.";
  if (type === "portfolio_verifiability_gap") return "Prioritize publishing a clear code portfolio for your strongest technical work.";
  if (type === "technical_evidence_gap") return "Prioritize completing one role-relevant technical project with reviewable evidence.";
  if (type === "technical_capability") return `Build on ${pretty(facts.category || "your strongest technical capability")} with a more complete, reviewable project outcome.`;
  if (type === "academic_strength") return "Use your academic consistency as a base while strengthening practical placement evidence.";
  if (type === "profile_skill_strength") return "Build one project or practice artifact that proves your strongest self-reported skills.";
  if (type === "professional_evidence") return "Build on your existing professional evidence by making the next proof point more role-relevant.";
  if (type === "preparation_capacity_strength") return "Use the available study capacity to complete the most important readiness gap first.";
  if (type === "leadership_strength") return "Bring your leadership experience into stronger project, interview, or collaboration evidence.";
  return "Focus first on the highest-impact improvement identified in the analysis.";
};

const renderDeterministicAnalysis = (input) => {
  const strongest = input.strengths[0];
  const mainGap = input.scoreBlockers[0] || input.careerRisks[0];
  const strength = strongest
    ? renderStrength(strongest)
    : "At this stage, the profile does not yet show a clear evidence-backed strength to highlight confidently.";
  const gap = mainGap
    ? (input.scoreBlockers.includes(mainGap) ? renderBlocker(mainGap) : renderRisk(mainGap))
    : "The next step is to make the profile easier for recruiters to evaluate.";
  const preparation = input.diagnosisContext?.preparationContext || {};
  const capacity = Number.isFinite(preparation.timelineMonths) && Number.isFinite(preparation.dailyStudyHours)
    ? `With ${preparation.timelineMonths} months and ${preparation.dailyStudyHours} study hours per day, the preparation capacity is ${preparation.feasibility}.`
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
