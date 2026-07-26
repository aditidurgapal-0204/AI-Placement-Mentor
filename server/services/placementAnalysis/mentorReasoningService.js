const { ROLE_COMPETENCIES } = require("../../configs/roleCompetencies.v1");
const { MENTOR_REASONING_RULES } = require("../../configs/mentorReasoningRules.v1");
const { READINESS_LABELS } = require("../../configs/readinessLabels.v1");
const { validateCanonicalEvidence, selectReasoningEvidence } = require("./evidenceValidationService");

const unique = (items = []) => [...new Set(items.filter(Boolean))];
const avg = (items) => items.length ? items.reduce((a, b) => a + b, 0) / items.length : 0;
const trace = (evidenceIds = [], contributionIds = []) => ({ evidenceIds: unique(evidenceIds), contributionIds: unique(contributionIds) });
const confidence = (items, fallback = 1) => ({
  value: items.length ? Number(avg(items.map((item) => Number(item.confidence ?? 1))).toFixed(3)) : fallback,
  basis: items.length ? "evidence" : "deterministic"
});

const normalizeRole = (value) => String(value || "").toLowerCase()
  .replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim()
  .replace(/^ml engineer$/, "machine learning engineer");

const resolveRoleCompetency = (targetRole) => {
  const role = normalizeRole(targetRole);
  return Object.entries(ROLE_COMPETENCIES).find(([, definition]) =>
    definition.onboardingValues.some((value) => normalizeRole(value) === role)
  ) || ["software_development_engineer", ROLE_COMPETENCIES.software_development_engineer];
};

const readinessBand = (score) => {
  const eligible = READINESS_LABELS.bands.filter(({ minimum }) => minimum <= score);
  const current = eligible.at(-1) || READINESS_LABELS.bands[0];
  const next = READINESS_LABELS.bands.find(({ minimum }) => minimum > score) || current;
  return { current, next, pointsToNext: Math.max(0, next.minimum - score) };
};

const projectItems = (evidence) => evidence.filter(({ type, value }) =>
  type === "project_evidence" && value?.displayName
);

const projectFacts = ({ value }) => ({
  name: value.displayName,
  projectType: value.projectType || null,
  complexity: value.complexity || null,
  capabilities: unique(value.capabilities || []).slice(0, 6),
  technologies: unique(value.technologies || []).slice(0, 5),
  deployed: value.deployment === true || value.deployed === true
});

const technicalFamily = (capabilities) => {
  const set = new Set(capabilities || []);
  if (set.has("fullStack") || (set.has("frontend") && set.has("backend"))) return "end_to_end_delivery";
  if (set.has("machine_learning")) return "applied_machine_learning";
  if (set.has("data")) return "data_practice";
  if (set.has("frontend")) return "interface_engineering";
  if (set.has("backend")) return "service_engineering";
  return "technical_execution";
};

const buildStrengths = (evidence, targetRole) => {
  const strengths = [];
  const usedFamilies = new Set();
  const qualification = MENTOR_REASONING_RULES.strengths.qualification;

  for (const project of projectItems(evidence)) {
    if (strengths.length >= 2) break;
    const family = technicalFamily(project.value.capabilities);
    const capabilities = unique(project.value.capabilities || []);
    const complexity = String(project.value.complexity || "").toLowerCase();
    const relevance = String(project.value.roleRelevance || project.value.companyFit || "unknown").toLowerCase();
    if (capabilities.length < qualification.minimumProjectCapabilityCount
      || !qualification.acceptedProjectComplexities.includes(complexity)
      || !qualification.acceptedProjectRelevance.includes(relevance)) continue;
    if (usedFamilies.has(family)) continue;
    usedFamilies.add(family);
    strengths.push({
      id: `strength-project-${strengths.length + 1}`,
      type: "project_strength",
      facts: { targetRole, category: family, project: projectFacts(project) },
      confidence: confidence([project]),
      internalTrace: trace([project.id], [])
    });
  }

  const cgpa = evidence.find(({ capability }) => capability === "cgpa");
  if (cgpa && Number(cgpa.value) >= qualification.minimumAcademicCgpa) strengths.push({
    id: "strength-academic",
    type: "academic_strength",
    facts: { targetRole, cgpa: Number(cgpa.value) },
    confidence: confidence([cgpa]),
    internalTrace: trace([cgpa.id], [])
  });

  const leadership = evidence.find(({ type }) =>
    ["responsibility_evidence", "activity_evidence"].includes(type)
  );
  if (leadership) strengths.push({
    id: "strength-leadership",
    type: "leadership_strength",
    facts: {
      targetRole,
      role: leadership.value?.role || null,
      organization: leadership.value?.organization || null,
      activity: leadership.type === "activity_evidence" ? leadership.capability : null
    },
    confidence: confidence([leadership]),
    internalTrace: trace([leadership.id], [])
  });

  const selfAssessedSkill = evidence.find(({ type, value }) =>
    type === "skill_level" && qualification.acceptedSelfAssessedLevels.includes(String(value || "").toLowerCase())
  );
  if (selfAssessedSkill) strengths.push({
    id: `strength-profile-${selfAssessedSkill.capability}`,
    type: "profile_skill_strength",
    facts: { targetRole, skill: selfAssessedSkill.capability, level: selfAssessedSkill.value },
    confidence: confidence([selfAssessedSkill]),
    internalTrace: trace([selfAssessedSkill.id], [])
  });

  return strengths.slice(0, MENTOR_REASONING_RULES.strengths.maximum);
};

const sourceType = (source = "") => {
  const value = source.toLowerCase();
  if (value.includes("cgpa")) return "academic_performance";
  if (value.includes("dsa")) return "dsa";
  if (value.includes("dbms")) return "dbms";
  if (value.includes("operating") || value.includes(".os")) return "os";
  if (value.includes("network")) return "networks";
  if (value.includes("aptitude")) return "aptitude";
  if (value.includes("communication")) return "communication";
  if (value.includes("internship")) return "internship";
  if (value.includes("certification")) return "certification";
  if (value.includes("github") || value.includes("portfolio")) return "code_portfolio";
  if (value.includes("cloud")) return "cloud";
  if (value.includes("scalability") || value.includes("system")) return "scalability";
  if (value.includes("project")) return "technical_projects";
  if (value.includes("targetdifficulty") || value.includes("baseadjustment")) return "target_alignment";
  if (value.includes("timeline") || value.includes("studyhours")) return "preparation_capacity";
  return source || "other";
};

const maximumPoints = (item) => {
  const values = [item.maximumPoints, item.maxPoints, item.possiblePoints, item.weight, item.availablePoints]
    .map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
};

const aliases = {
  academic_performance: ["cgpa"],
  technical_projects: ["project_identity", "technical_projects"],
  preparation_capacity: ["timeline_months", "daily_study_hours"],
  dsa: ["dsa", "data_structures_algorithms"],
  dbms: ["dbms", "database_management_systems"],
  os: ["os", "operating_systems"],
  networks: ["networks", "computer_networks"],
  aptitude: ["aptitude"],
  communication: ["communication"],
  internship: ["internship"],
  certification: ["certification", "certification_detail"],
  code_portfolio: ["code_portfolio", "github"],
  cloud: ["cloud"],
  scalability: ["scalability", "system_evidence", "system_design"]
};

const relatedEvidence = (evidence, capability) => evidence.filter((item) =>
  (aliases[capability] || [capability]).includes(String(item.capability || "").toLowerCase())
);

/*
 * Score drivers are included in the presentation-safe diagnosis context. Keep
 * this projection intentionally small: it gives the language layer concrete
 * facts to reference without exposing raw resume text, provenance paths, or
 * internal scoring identifiers.
 */
const driverSupportingFacts = (items = []) => {
  const projectExamples = [];
  const skillFacts = [];
  const academicFacts = [];
  const experienceFacts = [];
  const portfolioFacts = [];

  for (const item of items) {
    if (item.type === "project_evidence" && item.value?.displayName) {
      projectExamples.push({
        name: item.value.displayName,
        complexity: item.value.complexity || null,
        technologies: unique(item.value.technologies || []).slice(0, 4),
        capabilities: unique(item.value.capabilities || []).slice(0, 4),
        deployed: item.value.deploymentStatus === "verified"
      });
    } else if (item.type === "skill_level") {
      skillFacts.push({ skill: item.capability, level: item.value });
    } else if (item.capability === "cgpa" && Number.isFinite(Number(item.value))) {
      academicFacts.push({ cgpa: Number(item.value) });
    } else if (item.capability === "internship" && item.value?.exists) {
      experienceFacts.push({ internship: true });
    } else if (item.capability === "code_portfolio" && item.value?.exists) {
      portfolioFacts.push({ codePortfolio: true });
    }
  }

  return {
    projectExamples: projectExamples.slice(0, 2),
    skillFacts: skillFacts.slice(0, 3),
    academicFacts: academicFacts.slice(0, 1),
    experienceFacts: experienceFacts.slice(0, 1),
    portfolioFacts: portfolioFacts.slice(0, 1)
  };
};

const skillGap = (evidence, capability) => {
  const item = relatedEvidence(evidence, capability).find(({ type }) => type === "skill_level");
  if (!item) return null;
  const level = String(item.value || "").toLowerCase();
  if (!["beginner", "weak", "average"].includes(level)) return null;
  return { item, level, expectedLevel: capability === "communication" ? "strong" : "intermediate" };
};

const buildScoreDrivers = (ledger, evidence) => (ledger.contributions || [])
  .filter(({ points }) => Number(points) > 0)
  .map((item, index) => {
    const type = sourceType(item.source);
    const related = relatedEvidence(evidence, type);
    return {
      id: `driver-${index + 1}`,
      type,
      facts: {
        earnedPoints: Number(item.points),
        category: type,
        supportingFacts: driverSupportingFacts(related)
      },
      scoring: { affectsCurrentScore: true, earnedPoints: Number(item.points) },
      confidence: confidence(related),
      internalTrace: trace(related.map(({ id }) => id), item.id ? [item.id] : [])
    };
  })
  .sort((a, b) => b.scoring.earnedPoints - a.scoring.earnedPoints);

const buildScoreBlockers = (ledger, evidence, context) => {
  const blockers = [];
  const used = new Set();

  const add = (item) => {
    const key = item.facts?.category || item.type;
    if (used.has(key) || key === "preparation_capacity") return;
    used.add(key);
    blockers.push(item);
  };

  for (const contribution of ledger.contributions || []) {
    const category = sourceType(contribution.source);
    const earned = Number(contribution.points);
    const maximum = maximumPoints(contribution);

    if (earned < 0) {
      add({
        id: `blocker-${category}`,
        type: "score_penalty",
        facts: { category, targetRole: context.targetRole, companyType: context.companyType },
        scoring: { affectsCurrentScore: true, penaltyPoints: earned },
        confidence: confidence([]),
        internalTrace: trace([], contribution.id ? [contribution.id] : [])
      });
      continue;
    }

    if (Number.isFinite(maximum) && maximum - earned >= 0.75) {
      const gap = skillGap(evidence, category);
      const related = relatedEvidence(evidence, category);
      add({
        id: `blocker-${category}`,
        type: gap ? "skill_gap" : "score_gap",
        facts: {
          category,
          targetRole: context.targetRole,
          ...(gap ? { skill: category, currentLevel: gap.level, expectedLevel: gap.expectedLevel } : {})
        },
        scoring: {
          affectsCurrentScore: true,
          earnedPoints: earned,
          maximumPoints: maximum,
          gapPoints: Number((maximum - earned).toFixed(2))
        },
        confidence: confidence(related),
        internalTrace: trace(related.map(({ id }) => id), contribution.id ? [contribution.id] : [])
      });
    }
  }

  ["dsa", "dbms", "os", "networks", "aptitude", "communication"].forEach((capability) => {
    const gap = skillGap(evidence, capability);
    if (!gap) return;
    add({
      id: `blocker-${capability}`,
      type: "skill_gap",
      facts: {
        category: capability,
        skill: capability,
        currentLevel: gap.level,
        expectedLevel: gap.expectedLevel,
        targetRole: context.targetRole
      },
      scoring: { affectsCurrentScore: true, gapPoints: 1 },
      confidence: confidence([gap.item]),
      internalTrace: trace([gap.item.id], [])
    });
  });

  return blockers.sort((a, b) =>
    Math.abs(b.scoring.penaltyPoints || b.scoring.gapPoints || 0)
    - Math.abs(a.scoring.penaltyPoints || a.scoring.gapPoints || 0)
  ).slice(0, MENTOR_REASONING_RULES.blockers.maximumScoreBlockers);
};

const buildCareerRisks = (evidence, context) => {
  const statuses = new Map(
    evidence.filter(({ type }) => type === "resume_evidence_status")
      .map((item) => [item.capability, item])
  );
  const risks = [];

  const addAbsent = (capability, type) => {
    const item = statuses.get(capability);
    if (!item || item.value !== "not_detected") return;
    risks.push({
      id: `risk-${type}`,
      type,
      facts: { capability, targetRole: context.targetRole },
      affectsCurrentScore: false,
      confidence: confidence([item]),
      internalTrace: trace([item.id], [])
    });
  };

  addAbsent("internship", "professional_exposure_gap");
  addAbsent("code_portfolio", "portfolio_verifiability_gap");
  addAbsent("technical_projects", "technical_evidence_gap");
  addAbsent("cloud", "cloud_experience_gap");
  addAbsent("scalability", "scalability_experience_gap");
  addAbsent("deployment", "deployment_gap");

  return risks.slice(0, MENTOR_REASONING_RULES.blockers.maximumCareerRisks);
};

const buildPreparation = (evidence, score) => {
  const get = (capability) => Number(evidence.find((item) => item.capability === capability)?.value);
  const months = get("timeline_months");
  const dailyHours = get("daily_study_hours");
  const { pointsToNext } = readinessBand(score);
  const availableHours = Number.isFinite(months) && Number.isFinite(dailyHours) ? months * 30 * dailyHours : 0;
  const capacity = MENTOR_REASONING_RULES.preparation.capacityThresholds;
  const feasibility = availableHours >= capacity.strong ? "strong"
    : availableHours >= capacity.moderate ? "moderate" : "limited";
  return {
    feasibility,
    improvementPotential: `${feasibility}_capacity`,
    verifiedInputs: ["timelineMonths", "dailyStudyHours", "currentReadiness", "requiredImprovement"],
    facts: { timelineMonths: months, dailyStudyHours: dailyHours, availableHours, pointsToNextLevel: pointsToNext },
    internalTrace: trace(
      evidence.filter(({ capability }) => ["timeline_months", "daily_study_hours"].includes(capability)).map(({ id }) => id),
      []
    )
  };
};

const selectPriority = ({ scoreBlockers, careerRisks, strengths, preparation }) => {
  const candidates = [
    ...scoreBlockers.map((item) => ({
      item,
      sourceType: "score_blocker",
      rank: Math.abs(item.scoring?.penaltyPoints || item.scoring?.gapPoints || 0)
    })),
    ...careerRisks.map((item) => ({ item, sourceType: "career_risk", rank: 0.5 + item.confidence.value }))
  ].sort((a, b) => b.rank - a.rank);

  const selected = candidates[0];
  const source = selected?.item || strengths[0];
  if (!source) throw new Error("A traceable insight is required to select a priority.");

  return {
    id: "priority-1",
    sourceId: source.id,
    sourceType: selected?.sourceType || "strength_extension",
    facts: {
      targetInsightType: source.type,
      targetFacts: source.facts,
      reason: selected?.sourceType === "score_blocker"
        ? "largest_current_readiness_gap"
        : "highest_priority_employability_risk"
    },
    expectedImpact: {
      readinessScore: selected?.sourceType === "score_blocker",
      employabilityConfidence: true
    },
    preparationFeasibility: preparation.feasibility,
    internalTrace: trace(source.internalTrace?.evidenceIds, source.internalTrace?.contributionIds)
  };
};

const buildMentorReasoning = ({ canonicalEvidence, scoreLedger, context }) => {
  const validation = validateCanonicalEvidence(canonicalEvidence);
  if (!validation.valid) throw new Error(`Canonical evidence is invalid: ${validation.errors.join("; ")}`);

  const { accepted } = selectReasoningEvidence(canonicalEvidence);
  resolveRoleCompetency(context.targetRole);

  const strengths = buildStrengths(accepted, context.targetRole);
  const scoreDrivers = buildScoreDrivers(scoreLedger, accepted);
  const scoreBlockers = buildScoreBlockers(scoreLedger, accepted, context);
  const careerRisks = canonicalEvidence.assessment.resumeStatus === "assessed"
    ? buildCareerRisks(accepted, context)
    : [];
  const preparation = buildPreparation(accepted, scoreLedger.score);
  const priority = selectPriority({ scoreBlockers, careerRisks, strengths, preparation });
  const band = readinessBand(scoreLedger.score);

  return {
    readiness: {
      score: scoreLedger.score,
      labelKey: band.current.key,
      nextLabelKey: band.next.key,
      pointsToNextLevel: band.pointsToNext,
      facts: { targetRole: context.targetRole, companyType: context.companyType },
      internalTrace: trace([], (scoreLedger.contributions || []).map(({ id }) => id))
    },
    strengths,
    scoreDrivers,
    scoreBlockers,
    careerRisks,
    priority,
    preparation,
    traceIndex: Object.fromEntries(
      [...strengths, ...scoreDrivers, ...scoreBlockers, ...careerRisks, priority]
        .map((item) => [item.id, item.internalTrace])
    )
  };
};

module.exports = { buildMentorReasoning, resolveRoleCompetency, readinessBand };
