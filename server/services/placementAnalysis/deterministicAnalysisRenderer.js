const pretty = (value) => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const humanCategory = (value) => {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
  const labels = {
    end_to_end_delivery: "end-to-end product building",
    end_to_end_software_delivery: "end-to-end product building",
    applied_machine_learning: "applied machine learning work",
    data_practice: "practical data work",
    interface_engineering: "frontend interface work",
    service_engineering: "backend service work",
    technical_execution: "solid technical execution",
    production_engineering: "production engineering work",
    security_engineering: "security-focused engineering",
    mobile_engineering: "mobile engineering work",
    embedded_engineering: "embedded systems work",
    target_alignment: "target-company preparation",
    dsa: "Data Structures & Algorithms",
    dbms: "Database Management Systems",
    os: "Operating Systems",
    networks: "Computer Networks",
    aptitude: "aptitude",
    communication: "communication"
  };
  return labels[key] || pretty(value).toLowerCase();
};

const renderStrength = (item) => {
  const facts = item.facts || {};
  if (item.type === "project_strength") {
    const project = facts.project || {};
    const tech = (project.technologies || [])
      .filter((entry) => !/^(machine learning|ml)$/i.test(String(entry)))
      .slice(0, 3);
    const focus = humanCategory(facts.category || "technical_execution");
    return `${project.name || "A project"} shows ${focus}${tech.length ? ` with ${tech.join(", ")}` : ""}, which supports your target role.`;
  }
  if (item.type === "academic_strength") {
    return `A CGPA of ${facts.cgpa} shows consistent academic performance.`;
  }
  if (item.type === "leadership_strength") {
    return `${facts.role || pretty(facts.activity || "Leadership experience")}${facts.organization ? ` at ${facts.organization}` : ""} demonstrates ownership beyond coursework.`;
  }
  return `Your profile shows ${humanCategory(item.type)}.`;
};

const renderBlocker = (item) => {
  const facts = item.facts || {};
  if (item.type === "skill_gap") {
    return `${humanCategory(facts.skill)} is currently ${facts.currentLevel} and should reach ${facts.expectedLevel} for stronger interview readiness.`;
  }
  if (item.type === "score_penalty" && facts.category === "target_alignment") {
    return `Your ${facts.companyType || "selected"} target expects stronger proof of role-ready preparation than the current profile shows.`;
  }
  return `${humanCategory(facts.category || item.type)} is currently limiting your readiness.`;
};

const renderRisk = (item) => {
  if (item.type === "professional_exposure_gap") {
    return "Your resume does not yet show internship or equivalent real-world engineering experience.";
  }
  if (item.type === "cloud_experience_gap") {
    return "Your projects do not yet show practical cloud experience that product companies often look for.";
  }
  if (item.type === "scalability_experience_gap") {
    return "Your projects do not yet show clear scalability or system-design decisions.";
  }
  if (item.type === "deployment_gap") {
    return "Your projects do not yet show production deployment evidence.";
  }
  if (item.type === "portfolio_verifiability_gap") {
    return "Recruiters may find it hard to verify your work without a clearer public code portfolio.";
  }
  return `Your profile does not yet show ${humanCategory(item.facts?.capability || item.type)}.`;
};

const renderPriority = (priority) => {
  const facts = priority.facts?.targetFacts || {};
  const type = priority.facts?.targetInsightType;
  if (type === "skill_gap") {
    return `Focus first on raising ${humanCategory(facts.skill)} from ${facts.currentLevel} to ${facts.expectedLevel} with a weekly practice plan.`;
  }
  if (type === "professional_exposure_gap") {
    return "Focus first on gaining one reviewable real-world experience through an internship, open-source contribution, or team engineering project.";
  }
  if (type === "cloud_experience_gap") {
    return "Focus first on deploying one existing project with a cloud service so your profile shows production delivery.";
  }
  if (type === "scalability_experience_gap") {
    return "Focus first on documenting scalability and system decisions in one deployed project.";
  }
  if (type === "deployment_gap") {
    return "Focus first on deploying one existing application so recruiters can see production-ready delivery.";
  }
  if (type === "portfolio_verifiability_gap") {
    return "Focus first on publishing your strongest project with a clear README and public repository.";
  }
  if (type === "score_penalty" && facts.category === "target_alignment") {
    return "Focus first on closing the largest role-ready gap for your company target, especially production proof on your strongest project.";
  }
  return "Focus first on the highest-impact gap that will make your profile easier to shortlist.";
};

const renderDeterministicAnalysis = (input) => {
  const strongest = input.strengths[0];
  const mainGap = input.scoreBlockers[0] || input.careerRisks[0];
  const strength = strongest ? renderStrength(strongest) : "You already have a usable foundation for placement preparation.";
  const gap = mainGap
    ? (input.scoreBlockers.includes(mainGap) ? renderBlocker(mainGap) : renderRisk(mainGap))
    : "The next step is to make your profile easier for recruiters to evaluate.";
  const preparation = input.preparation?.facts || input.preparationContext || {};
  const months = preparation.timelineMonths;
  const hours = preparation.dailyStudyHours;
  const feasibility = input.preparation?.feasibility || preparation.feasibility;
  const capacity = Number.isFinite(months) && Number.isFinite(hours)
    ? `With ${months} months and ${hours} study hours per day, your preparation capacity looks ${feasibility || "usable"} if you stay focused on one priority at a time.`
    : "";

  return {
    analysisId: input.analysisId,
    diagnosis: [
      `Your readiness score of ${input.readiness.score}% puts you in the ${pretty(input.readiness.labelKey)} stage for a ${input.context.targetRole} path.`,
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

module.exports = { renderDeterministicAnalysis, humanCategory };
