/**
 * server/services/readiness/scoreCalculator.js
 * Deterministic, role-aware, evidence-backed readiness scoring.
 * Gemini must never calculate or modify this score.
 */

const {
  LEVEL_MULTIPLIERS,
  COMMON_CATEGORY_MAXIMUMS,
  getRoleConfig
} = require("./roleWeightsConfiguration");

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const normalized = (value) => String(value || "").trim().toLowerCase();

const levelMultiplier = (value) => LEVEL_MULTIPLIERS[normalized(value)] ?? 0;

const addContribution = (contributions, source, points, metadata = {}) => {
  contributions.push({ source, points: round2(points), ...metadata });
};

const scoreCgpa = (cgpa) => {
  const value = Number.parseFloat(cgpa);
  if (Number.isNaN(value)) return 0;
  if (value >= 9) return 8;
  if (value >= 8) return 7;
  if (value >= 7) return 5.5;
  if (value >= 6) return 3.5;
  if (value >= 5) return 1.5;
  return 0;
};

const scorePreparationCapacity = (timeline = {}) => {
  const months = Number.parseInt(timeline.preparationTimelineMonths, 10);
  const dailyHours = Number.parseFloat(timeline.dailyStudyHours);

  const monthScore = Number.isNaN(months)
    ? 0
    : months >= 9 ? 1.1
      : months >= 6 ? 0.9
        : months >= 3 ? 0.6
          : months >= 1 ? 0.3
            : 0;

  const hoursScore = Number.isNaN(dailyHours)
    ? 0
    : dailyHours >= 5 ? 0.9
      : dailyHours >= 3 ? 0.7
        : dailyHours >= 2 ? 0.45
          : dailyHours >= 1 ? 0.2
            : 0;

  return clamp(monthScore + hoursScore, 0, COMMON_CATEGORY_MAXIMUMS.preparationCapacity);
};

const scoreTechnicalSkills = (skills, roleConfig, contributions) => {
  let total = 0;
  Object.entries(roleConfig.technicalSkills).forEach(([skill, maximum]) => {
    const points = maximum * levelMultiplier(skills?.[skill]);
    total += points;
    addContribution(contributions, `profile.${skill}`, points, {
      category: "technicalSkills",
      maximum,
      level: normalized(skills?.[skill]) || "unknown"
    });
  });

  // Some roles depend on evidence that is not captured by the current onboarding skill form.
  // The unallocated portion remains unearned rather than being guessed.
  return clamp(total, 0, COMMON_CATEGORY_MAXIMUMS.technicalSkills);
};

const scoreCommunicationAndAptitude = (skills, roleConfig, contributions) => {
  let total = 0;
  Object.entries(roleConfig.communicationAptitude).forEach(([skill, maximum]) => {
    const points = maximum * levelMultiplier(skills?.[skill]);
    total += points;
    addContribution(contributions, `profile.${skill}`, points, {
      category: "communicationAptitude",
      maximum,
      level: normalized(skills?.[skill]) || "unknown"
    });
  });
  return clamp(total, 0, COMMON_CATEGORY_MAXIMUMS.communicationAptitude);
};

const projectComplexityMultiplier = (complexity) => {
  const value = normalized(complexity);
  if (value === "advanced") return 1;
  if (value === "intermediate") return 0.68;
  if (value === "basic") return 0.35;
  return 0;
};

const projectRoleRelevanceMultiplier = (project) => {
  const value = normalized(project?.roleRelevance || project?.companyFit);
  if (["high", "excellent", "strong"].includes(value)) return 1;
  if (["medium", "acceptable", "moderate"].includes(value)) return 0.72;
  if (["low", "below target", "weak"].includes(value)) return 0.4;
  return 0.6;
};

const scoreProjects = (projects = {}, roleConfig, contributions) => {
  const evaluatedProjects = Array.isArray(projects.evaluatedProjects) ? projects.evaluatedProjects : [];
  const projectCount = Math.max(Number(projects.projectCount) || evaluatedProjects.length || 0, 0);

  if (!projectCount) {
    addContribution(contributions, "resume.projects", 0, {
      category: "projects",
      maximum: COMMON_CATEGORY_MAXIMUMS.projects,
      reason: "no_verified_projects"
    });
    return 0;
  }

  const countPoints = Math.min(projectCount, 3) / 3 * 6;

  const bestProjects = evaluatedProjects
    .map((project) => projectComplexityMultiplier(project.complexity) * projectRoleRelevanceMultiplier(project))
    .sort((a, b) => b - a)
    .slice(0, 3);
  const qualityPoints = bestProjects.length
    ? (bestProjects.reduce((sum, value) => sum + value, 0) / Math.min(3, bestProjects.length)) * 10
    : projectComplexityMultiplier(projects.complexity) * 10;

  const capabilities = projects.capabilities || {};
  const weightedSignals = Object.entries(roleConfig.projectSignals)
    .filter(([signal]) => capabilities[signal])
    .map(([, weight]) => weight);
  const signalWeightTotal = Object.values(roleConfig.projectSignals).reduce((sum, weight) => sum + weight, 0);
  const demonstratedWeight = weightedSignals.reduce((sum, weight) => sum + weight, 0);
  const capabilityPoints = signalWeightTotal > 0 ? demonstratedWeight / signalWeightTotal * 7 : 0;

  const productionPoints = clamp(
    (projects.deployment || capabilities.deployment ? 1.1 : 0)
      + (projects.cloudExposure || capabilities.cloud ? 0.8 : 0)
      + (projects.systemDesignExposure || capabilities.scalability || capabilities.distributedSystems ? 0.7 : 0),
    0,
    2
  );

  const total = clamp(countPoints + qualityPoints + capabilityPoints + productionPoints, 0, COMMON_CATEGORY_MAXIMUMS.projects);
  addContribution(contributions, "resume.projects", total, {
    category: "projects",
    maximum: COMMON_CATEGORY_MAXIMUMS.projects,
    projectCount,
    complexity: projects.complexity || "Unknown"
  });
  return total;
};

const scoreProfessionalExposure = (resumeEvidence, contributions) => {
  const internship = resumeEvidence?.internship || {};
  const hasInternship = internship.exists === true;
  const relevance = normalized(internship.relevance);
  const points = !hasInternship ? 0 : relevance === "high" ? 10 : relevance === "medium" ? 7 : 5;
  addContribution(contributions, "resume.internship", points, {
    category: "professionalExposure",
    maximum: COMMON_CATEGORY_MAXIMUMS.professionalExposure,
    verified: hasInternship
  });
  return points;
};

const scorePortfolio = (resumeEvidence, contributions) => {
  const projects = resumeEvidence?.projects || {};
  const capabilities = projects.capabilities || {};
  const hasGithub = resumeEvidence?.hasGitHub === true;
  const deployed = projects.deployment === true || capabilities.deployment === true;
  const cloud = projects.cloudExposure === true || capabilities.cloud === true;
  const systemEvidence = projects.systemDesignExposure === true
    || capabilities.scalability === true
    || capabilities.distributedSystems === true;

  const points = clamp(
    (hasGithub ? 3 : 0)
      + (deployed ? 3 : 0)
      + (cloud ? 1 : 0)
      + (systemEvidence ? 1 : 0),
    0,
    COMMON_CATEGORY_MAXIMUMS.portfolio
  );

  addContribution(contributions, "resume.portfolio", points, {
    category: "portfolio",
    maximum: COMMON_CATEGORY_MAXIMUMS.portfolio,
    hasGithub,
    deployed,
    cloud,
    systemEvidence
  });
  return points;
};

const scoreCertifications = (resumeEvidence, contributions) => {
  const count = Number(resumeEvidence?.certifications?.count) || 0;
  const points = clamp(count, 0, COMMON_CATEGORY_MAXIMUMS.certifications);
  addContribution(contributions, "resume.certifications", points, {
    category: "certifications",
    maximum: COMMON_CATEGORY_MAXIMUMS.certifications,
    count
  });
  return points;
};

const scoreLeadership = (resumeEvidence, contributions) => {
  const exists = resumeEvidence?.leadership?.exists === true;
  const points = exists ? COMMON_CATEGORY_MAXIMUMS.leadership : 0;
  addContribution(contributions, "resume.leadership", points, {
    category: "leadership",
    maximum: COMMON_CATEGORY_MAXIMUMS.leadership,
    verified: exists
  });
  return points;
};

const targetDifficultyFactor = (companyRules = {}) => {
  const failurePenalty = Math.abs(Number(companyRules.failurePenalty) || 0);
  if (failurePenalty >= 30) return 0.9;
  if (failurePenalty >= 15) return 0.95;
  return 1;
};

const calculateReadinessScoreBreakdown = (
  skills = {},
  timeline = {},
  cgpa,
  targetRole,
  companyRules = {},
  resumeEvidence = null
) => {
  const contributions = [];
  const roleConfig = getRoleConfig(targetRole);
  const hasResumeEvidence = Boolean(resumeEvidence);

  const categoryScores = {
    technicalSkills: scoreTechnicalSkills(skills, roleConfig, contributions),
    projects: hasResumeEvidence ? scoreProjects(resumeEvidence.projects, roleConfig, contributions) : 0,
    academics: scoreCgpa(cgpa),
    professionalExposure: hasResumeEvidence ? scoreProfessionalExposure(resumeEvidence, contributions) : 0,
    portfolio: hasResumeEvidence ? scorePortfolio(resumeEvidence, contributions) : 0,
    communicationAptitude: scoreCommunicationAndAptitude(skills, roleConfig, contributions),
    certifications: hasResumeEvidence ? scoreCertifications(resumeEvidence, contributions) : 0,
    leadership: hasResumeEvidence ? scoreLeadership(resumeEvidence, contributions) : 0,
    preparationCapacity: scorePreparationCapacity(timeline)
  };

  addContribution(contributions, "profile.cgpa", categoryScores.academics, {
    category: "academics",
    maximum: COMMON_CATEGORY_MAXIMUMS.academics,
    cgpa: Number.parseFloat(cgpa) || null
  });
  addContribution(contributions, "profile.timeline", categoryScores.preparationCapacity, {
    category: "preparationCapacity",
    maximum: COMMON_CATEGORY_MAXIMUMS.preparationCapacity,
    timelineMonths: Number.parseInt(timeline.preparationTimelineMonths, 10) || null,
    dailyStudyHours: Number.parseFloat(timeline.dailyStudyHours) || null
  });

  const rawScore = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);
  const difficultyFactor = targetDifficultyFactor(companyRules);
  const adjustedScore = rawScore * difficultyFactor;
  const companyAdjustment = adjustedScore - rawScore;

  addContribution(contributions, "company.targetDifficulty", companyAdjustment, {
    category: "targetDifficulty",
    factor: difficultyFactor
  });

  const score = clamp(Math.round(adjustedScore), 0, 100);
  const positiveContributions = contributions.filter(({ points }) => points > 0);
  const negativeContributions = contributions.filter(({ points }) => points < 0);

  return {
    score,
    rawScore: round2(rawScore),
    categoryScores: Object.fromEntries(Object.entries(categoryScores).map(([key, value]) => [key, round2(value)])),
    categoryMaximums: COMMON_CATEGORY_MAXIMUMS,
    targetDifficultyFactor: difficultyFactor,
    positiveContributions,
    negativeContributions,
    contributions
  };
};

const calculateReadinessScore = (...args) => calculateReadinessScoreBreakdown(...args).score;

module.exports = { calculateReadinessScore, calculateReadinessScoreBreakdown };
