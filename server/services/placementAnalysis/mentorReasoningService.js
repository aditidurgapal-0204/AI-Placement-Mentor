const { ROLE_COMPETENCIES } = require("../../configs/roleCompetencies.v1");
const { MENTOR_REASONING_RULES } = require("../../configs/mentorReasoningRules.v1");
const { READINESS_LABELS } = require("../../configs/readinessLabels.v1");
const { validateCanonicalEvidence, selectReasoningEvidence } = require("./evidenceValidationService");

const humanize = (value) => String(value || "verified capability")
  .replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const unique = (values) => [...new Set(values.filter(Boolean))];

const capabilityLanguage = {
  end_to_end_software_delivery: "build complete applications across the user interface, server, and data layers",
  applied_machine_learning: "apply machine-learning techniques in practical projects",
  data_practice: "work with data-focused systems and workflows",
  production_engineering: "take software beyond local development toward reliable deployment",
  security_engineering: "apply security practices while building software",
  interface_engineering: "build usable frontend experiences",
  service_engineering: "design backend services and application logic",
  mobile_engineering: "build mobile applications",
  embedded_engineering: "build software that works with hardware systems"
};

const scoreFactorLanguage = {
  academic_performance: "academic record",
  preparation_runway: "available preparation time",
  target_alignment: "preparation for the selected company type",
  technical_evidence: "project work",
  professional_evidence: "real-world and leadership experience",
  preparation_foundation: "core interview preparation"
};

const blockerAction = (type, targetRole) => ({
  academic_performance: "Strengthen your project, interview, and problem-solving record so recruiters have stronger evidence beyond academic cutoffs.",
  preparation_runway: "Use the available time on one weekly plan covering the most important interview topics and one role-relevant project improvement.",
  target_alignment: `Bring your core interview preparation up to the level expected for ${targetRole} roles at the selected company type.`,
  technical_evidence: "Improve one existing project until it clearly demonstrates implementation depth, testing, and a complete working outcome.",
  professional_evidence: "Gain one real-world experience through an internship, open-source contribution, freelance task, or team project.",
  preparation_foundation: "Create a regular DSA and core-subject revision routine, and review progress every week."
}[type] || "Work on the highest-impact gap first and track one clear outcome each week.");

const normalizeRoleValue = (value) => String(value || "")
  .toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim()
  .replace(/^ml engineer$/, "machine learning engineer");

const resolveRoleCompetency = (targetRole) => {
  const normalized = normalizeRoleValue(targetRole);
  return Object.entries(ROLE_COMPETENCIES).find(([, definition]) => definition.onboardingValues
    .some((value) => normalizeRoleValue(value) === normalized)) || ["software_development_engineer", ROLE_COMPETENCIES.software_development_engineer];
};

const trace = (evidenceIds = [], contributionIds = []) => ({
  evidenceIds: unique(evidenceIds),
  contributionIds: unique(contributionIds)
});

const confidenceFor = (evidence, fallback = 1) => ({
  value: evidence.length ? Number(average(evidence.map(({ confidence }) => confidence)).toFixed(3)) : fallback,
  basis: evidence.length ? "aggregated verified evidence confidence" : "deterministic score contribution"
});

const semanticInsight = ({ id, type, label, evidence = [], contributionIds = [], targetRole, readinessImpact }) => ({
  id,
  type,
  conclusion: type === "technical_capability"
    ? capabilityLanguage[label]
      ? `Your projects show that you can ${capabilityLanguage[label]}.`
      : `Your projects show practical ${humanize(label)}.`
    : `Your profile shows ${label}.`,
  studentMeaning: type === "technical_capability"
    ? "This gives recruiters a clearer example of how you apply technical knowledge in working software."
    : "This is a useful part of your current placement profile.",
  roleConnection: `This supports your preparation for ${targetRole} roles.`,
  confidence: confidenceFor(evidence),
  ...(readinessImpact ? { readinessImpact } : {}),
  internalTrace: trace(evidence.map(({ id: evidenceId }) => evidenceId), contributionIds)
});

const groupTechnicalStrengths = (evidence, targetRole) => {
  const technical = evidence.filter(({ type, value }) => type === "demonstrated_capability" && value === true);
  const used = new Set();
  const candidates = Object.entries(MENTOR_REASONING_RULES.capabilityGroups).map(([group, capabilities]) => {
    const matches = technical.filter(({ capability }) => capabilities.includes(capability));
    return { group, matches, score: matches.length * average(matches.map(({ confidence }) => confidence)) };
  }).filter(({ matches }) => matches.length).sort((a, b) => b.score - a.score || a.group.localeCompare(b.group));

  const strengths = [];
  candidates.forEach(({ group, matches }) => {
    const unused = matches.filter(({ id }) => !used.has(id));
    if (!unused.length || strengths.length >= 3) return;
    unused.forEach(({ id }) => used.add(id));
    strengths.push(semanticInsight({
      id: `strength-technical-${strengths.length + 1}`,
      type: "technical_capability",
      label: group,
      evidence: unused,
      targetRole,
      readinessImpact: "supports practical role readiness"
    }));
  });

  const remaining = technical.filter(({ id }) => !used.has(id));
  if (remaining.length && strengths.length < 3) strengths.push(semanticInsight({
    id: `strength-technical-${strengths.length + 1}`,
    type: "technical_capability",
    label: "technical execution in working projects",
    evidence: remaining,
    targetRole,
    readinessImpact: "supports practical role readiness"
  }));
  return strengths;
};

const contributionEvidence = (evidence, driverType) => {
  if (driverType === "academic_performance") return evidence.filter(({ capability }) => capability === "cgpa");
  if (driverType === "preparation_runway") return evidence.filter(({ capability }) => ["timeline_months", "daily_study_hours"].includes(capability));
  if (driverType === "technical_evidence") return evidence.filter(({ domain, type }) => domain === "resume" && ["demonstrated_capability", "evidence_depth"].includes(type));
  if (driverType === "professional_evidence") return evidence.filter(({ type }) => type === "responsibility_evidence" || type === "professional_experience");
  return evidence.filter(({ domain, type }) => domain === "profile" && type === "skill_level");
};

const contributionGroup = (source) => {
  if (source === "profile.cgpa") return "academic_performance";
  if (source === "profile.timeline") return "preparation_runway";
  if (source === "company.baseAdjustment" || source === "company.requiredSkills") return "target_alignment";
  if (source === "resume.leadership") return "professional_evidence";
  if (source.startsWith("resume.")) return "technical_evidence";
  return "preparation_foundation";
};

const buildScoreInsights = (scoreLedger, evidence, targetRole, sign) => {
  const grouped = new Map();
  scoreLedger.contributions.filter((item) => item.sign === sign).forEach((item) => {
    const type = contributionGroup(item.source);
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type).push(item);
  });
  return [...grouped.entries()].map(([type, contributions], index) => {
    const relatedEvidence = contributionEvidence(evidence, type);
    const points = contributions.reduce((total, item) => total + item.points, 0);
    const isDriver = sign === "positive";
    return {
      id: `${isDriver ? "driver" : "score-blocker"}-${index + 1}`,
      type,
      conclusion: isDriver
        ? `Your ${scoreFactorLanguage[type] || humanize(type)} is helping your current readiness.`
        : `Your ${scoreFactorLanguage[type] || humanize(type)} is currently holding back your readiness.`,
      studentMeaning: isDriver
        ? "This is one reason your current placement foundation is stronger."
        : "This is one reason your readiness is not yet at the next level.",
      roleConnection: isDriver
        ? `Keep building on this while preparing for ${targetRole} interviews.`
        : blockerAction(type, targetRole),
      confidence: confidenceFor(relatedEvidence),
      contributionIds: contributions.map(({ id }) => id),
      scoreEffect: points,
      internalTrace: trace(relatedEvidence.map(({ id }) => id), contributions.map(({ id }) => id))
    };
  }).sort((a, b) => Math.abs(b.scoreEffect) - Math.abs(a.scoreEffect));
};

const riskDefinition = (capability) => {
  if (capability === "internship") return ["professional_exposure", "real-world engineering experience"];
  if (capability === "code_portfolio") return ["portfolio_verifiability", "a public portfolio that recruiters can review"];
  if (capability === "technical_projects") return ["technical_evidence_depth", "enough project work to demonstrate your technical ability"];
  if (["deployment", "cloud", "scalability"].includes(capability)) return ["production_readiness", "a project that demonstrates deployment and production-quality work"];
  return null;
};

const roleAcceptsRisk = (roleKey, riskType) => {
  if (riskType === "professional_exposure") return true;
  if (riskType === "portfolio_verifiability") return roleKey !== "associate_product_manager";
  if (riskType === "technical_evidence_depth") return roleKey !== "associate_product_manager";
  if (riskType === "production_readiness") {
    const relevant = ["software_development_engineer", "frontend_developer", "backend_developer", "full_stack_engineer", "machine_learning_engineer", "cloud_devops_engineer", "mobile_application_developer"];
    return relevant.includes(roleKey);
  }
  return false;
};

const buildCareerRisks = (evidence, roleKey, targetRole, hasScoreBlockers) => {
  const absence = evidence.filter(({ type, value }) => type === "resume_evidence_status" && value === "not_detected");
  const grouped = new Map();
  absence.forEach((item) => {
    const definition = riskDefinition(item.capability);
    if (!definition || !roleAcceptsRisk(roleKey, definition[0])) return;
    if (!grouped.has(definition[0])) grouped.set(definition[0], { label: definition[1], evidence: [] });
    grouped.get(definition[0]).evidence.push(item);
  });

  if (!hasScoreBlockers) {
    const preparationGaps = evidence.filter(({ type, value }) => type === "skill_level" && ["beginner", "weak"].includes(String(value).toLowerCase()));
    if (preparationGaps.length) grouped.set("preparation_consistency", {
      label: "consistent preparation across core interview subjects",
      evidence: preparationGaps
    });
  }

  const conclusionFor = (type, label) => ({
    preparation_consistency: "Your preparation is not yet consistent across the core subjects used in technical interviews.",
    professional_exposure: "Your profile needs more experience working in a real team or engineering setting.",
    portfolio_verifiability: "Recruiters do not yet have a clear public place to review your strongest work.",
    technical_evidence_depth: `Your profile needs a stronger project that demonstrates the technical work expected in a ${targetRole} role.`,
    production_readiness: "Your projects need clearer proof of deployment and production-quality work."
  }[type] || `Your profile needs clearer proof of ${label}.`);
  const actionFor = (type) => ({
    preparation_consistency: "Create a regular DSA and core-subject revision routine, and review progress every week.",
    professional_exposure: "Gain one real-world experience through an internship, open-source contribution, freelance task, or team project.",
    portfolio_verifiability: "Publish your strongest work in a reviewable portfolio and explain what you personally built.",
    technical_evidence_depth: `Complete one focused project that clearly demonstrates the work expected in a ${targetRole} role.`,
    production_readiness: "Improve one existing project with deployment, testing, documentation, and a clear working outcome."
  }[type] || "Add one clear, reviewable example that closes this gap.");

  return [...grouped.entries()].map(([type, details], index) => ({
    id: `career-risk-${index + 1}`,
    type,
    conclusion: conclusionFor(type, details.label),
    studentMeaning: "This does not reduce the current score, but it can make it harder for recruiters to judge your practical readiness.",
    roleConnection: actionFor(type),
    confidence: confidenceFor(details.evidence),
    affectsCurrentScore: false,
    scoreEffect: 0,
    contributionIds: [],
    internalTrace: trace(details.evidence.map(({ id }) => id), [])
  })).sort((a, b) => b.confidence.value - a.confidence.value).slice(0, MENTOR_REASONING_RULES.blockers.maximumCareerRisks);
};

const buildProfileStrengths = (evidence, scoreDrivers, targetRole) => {
  const strengths = [];
  const skillEvidence = evidence.filter(({ type, value }) => type === "skill_level" && !["beginner", "weak"].includes(String(value).toLowerCase()));
  if (skillEvidence.length) strengths.push(semanticInsight({
    id: "strength-profile-foundation", type: "preparation_foundation", label: "a useful foundation in interview preparation",
    evidence: skillEvidence, contributionIds: scoreDrivers.filter(({ type }) => type === "preparation_foundation").flatMap(({ contributionIds }) => contributionIds), targetRole
  }));
  const academic = evidence.filter(({ capability }) => capability === "cgpa");
  if (academic.length && scoreDrivers.some(({ type }) => type === "academic_performance")) strengths.push(semanticInsight({
    id: "strength-academic", type: "academic_consistency", label: "a consistent academic record",
    evidence: academic, contributionIds: scoreDrivers.filter(({ type }) => type === "academic_performance").flatMap(({ contributionIds }) => contributionIds), targetRole
  }));
  const professional = evidence.filter(({ type }) => ["professional_experience", "responsibility_evidence", "research_evidence", "collaboration_evidence"].includes(type));
  if (professional.length) strengths.push(semanticInsight({
    id: "strength-professional", type: "professional_evidence", label: "experience taking responsibility beyond individual coursework",
    evidence: professional, contributionIds: scoreDrivers.filter(({ type }) => type === "professional_evidence").flatMap(({ contributionIds }) => contributionIds), targetRole
  }));
  return strengths;
};

const readinessBand = (score) => {
  const eligible = READINESS_LABELS.bands.filter(({ minimum }) => minimum <= score);
  const current = eligible.at(-1) || READINESS_LABELS.bands[0];
  const next = READINESS_LABELS.bands.find(({ minimum }) => minimum > score) || current;
  return { current, next, pointsToNext: Math.max(0, next.minimum - score) };
};

const buildPreparation = (evidence, score) => {
  const findNumber = (capability) => Number(evidence.find((item) => item.capability === capability)?.value);
  const months = findNumber("timeline_months");
  const dailyHours = findNumber("daily_study_hours");
  const { pointsToNext } = readinessBand(score);
  const availableHours = Number.isFinite(months) && Number.isFinite(dailyHours) ? months * 30 * dailyHours : 0;
  const capacity = MENTOR_REASONING_RULES.preparation.capacityThresholds;
  const feasibility = availableHours >= capacity.strong ? "strong" : availableHours >= capacity.moderate ? "moderate" : "limited";
  const improvement = MENTOR_REASONING_RULES.preparation.improvementThresholds;
  const requiredBand = pointsToNext >= improvement.substantial ? "substantial" : pointsToNext >= improvement.moderate ? "moderate" : "focused";
  const sourceEvidence = evidence.filter(({ capability }) => ["timeline_months", "daily_study_hours"].includes(capability));
  return {
    feasibility,
    improvementPotential: `${feasibility}_capacity_for_${requiredBand}_improvement`,
    verifiedInputs: ["timelineMonths", "dailyStudyHours", "currentReadiness", "requiredImprovement"],
    internalTrace: trace(sourceEvidence.map(({ id }) => id), [])
  };
};

const selectPriority = ({ scoreBlockers, careerRisks, strengths, preparation, targetRole }) => {
  const blockerCandidates = scoreBlockers.map((item) => ({ item, sourceType: "score_blocker", score: Math.abs(item.scoreEffect) + item.confidence.value }));
  const riskCandidates = careerRisks.map((item) => ({ item, sourceType: "career_risk", score: 5 + item.confidence.value }));
  const selected = [...blockerCandidates, ...riskCandidates].sort((a, b) => b.score - a.score)[0];
  const source = selected?.item || strengths[0];
  if (!source) throw new Error("A traceable strength, score blocker, or career risk is required to select a priority.");
  const sourceType = selected?.sourceType || "strength_extension";
  const affectsScore = sourceType === "score_blocker";
  return {
    id: "priority-1",
    sourceId: source.id,
    sourceType,
    objective: affectsScore
      ? blockerAction(source.type, targetRole)
      : source.roleConnection,
    whyFirst: affectsScore
      ? "This comes first because it is the biggest current reason your readiness score is not higher."
      : "It is the clearest next step for making your profile easier for recruiters to trust and evaluate.",
    expectedImpact: { readinessScore: affectsScore, employabilityConfidence: true },
    preparationFeasibility: preparation.feasibility,
    internalTrace: trace(source.internalTrace?.evidenceIds, source.internalTrace?.contributionIds)
  };
};

const buildMentorReasoning = ({ canonicalEvidence, scoreLedger, context }) => {
  const validation = validateCanonicalEvidence(canonicalEvidence);
  if (!validation.valid) throw new Error(`Canonical evidence is invalid: ${validation.errors.join("; ")}`);
  const { accepted } = selectReasoningEvidence(canonicalEvidence);
  const [roleKey] = resolveRoleCompetency(context.targetRole);
  const scoreDrivers = buildScoreInsights(scoreLedger, accepted, context.targetRole, "positive");
  const scoreBlockers = buildScoreInsights(scoreLedger, accepted, context.targetRole, "negative");
  const strengths = [
    ...groupTechnicalStrengths(accepted, context.targetRole),
    ...buildProfileStrengths(accepted, scoreDrivers, context.targetRole)
  ].slice(0, MENTOR_REASONING_RULES.strengths.maximum);
  const careerRisks = canonicalEvidence.assessment.resumeStatus === "assessed"
    ? buildCareerRisks(accepted, roleKey, context.targetRole, scoreBlockers.length > 0)
    : buildCareerRisks(accepted, roleKey, context.targetRole, scoreBlockers.length > 0).filter(({ type }) => type === "preparation_consistency");
  const preparation = buildPreparation(accepted, scoreLedger.score);
  const priority = selectPriority({ scoreBlockers, careerRisks, strengths, preparation, targetRole: context.targetRole });
  const band = readinessBand(scoreLedger.score);
  const explanationTrace = trace([], [
    ...scoreDrivers.flatMap(({ contributionIds }) => contributionIds),
    ...scoreBlockers.flatMap(({ contributionIds }) => contributionIds)
  ]);

  return {
    readiness: {
      score: scoreLedger.score,
      labelKey: band.current.key,
      nextLabelKey: band.next.key,
      pointsToNextLevel: band.pointsToNext,
      explanation: scoreBlockers.length
        ? "Your score reflects a useful preparation base, but one or more important gaps are still holding you below the next readiness level."
        : "Your score reflects the preparation and profile strengths you already have, while the remaining improvements mainly affect how strongly recruiters can evaluate your readiness.",
      internalTrace: explanationTrace
    },
    strengths,
    scoreDrivers,
    scoreBlockers,
    careerRisks,
    priority,
    preparation,
    traceIndex: Object.fromEntries([...strengths, ...scoreDrivers, ...scoreBlockers, ...careerRisks, priority]
      .map((item) => [item.id, item.internalTrace]))
  };
};

module.exports = { buildMentorReasoning, resolveRoleCompetency, readinessBand };
