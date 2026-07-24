const { ROLE_WEIGHTS } = require("./structuredProjectEvidence");

const GENERIC_PRIORITY = {
  recommendationSystem: 5, machineLearning: 4, featureEngineering: 4, dataPreprocessing: 4,
  systemDesign: 4, scalability: 4, distributedSystems: 4, cybersecurity: 4,
  backend: 3, frontend: 3, databaseIntegration: 3, authentication: 3,
  deployment: 2, cloud: 3, visualization: 3, dataAnalysis: 3, mobile: 3,
  automation: 2, apiIntegration: 2, accessibility: 2
};

const factType = (category) => `${category.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}_evidence`;

const compactStrengthFact = (candidate) => {
  const typeByCategory = {
    fullStack: "fullStackDevelopment",
    frontend: "frontendDevelopment",
    backend: "backendDevelopment",
    databaseIntegration: "databaseIntegration",
    machineLearning: "machineLearning",
    recommendationSystem: "recommendationSystem",
    github: "github_presence"
  };
  const compact = {
    type: typeByCategory[candidate.category] || candidate.category,
    category: candidate.category,
    projectCount: candidate.projectCount
  };

  if (["fullStack", "frontend", "backend", "databaseIntegration", "machineLearning", "recommendationSystem"].includes(candidate.category)) {
    const methodNames = new Set((candidate.methods || []).map((value) => value.toLowerCase()));
    const categoryTerms = new Set((candidate.evidenceTerms || []).map((value) => value.toLowerCase()));
    const categoryTechnologies = candidate.category === "databaseIntegration" && categoryTerms.size
      ? (candidate.technologies || []).filter((value) => categoryTerms.has(value.toLowerCase()))
      : candidate.technologies || [];
    compact.primaryTechnologies = categoryTechnologies
      .filter((value) => typeof value === "string" && value.length <= 30 && !/https?:\/\//i.test(value) && !methodNames.has(value.toLowerCase()))
      .slice(0, 3);
  }
  if (["machineLearning", "recommendationSystem", "featureEngineering", "dataPreprocessing"].includes(candidate.category)) {
    compact.methods = (candidate.methods || []).slice(0, 3);
  }
  if (candidate.category === "leadership") {
    compact.role = candidate.role;
    compact.organization = candidate.organization;
  }
  if (candidate.category === "github") compact.exists = true;

  return Object.fromEntries(Object.entries(compact).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0)));
};

const rankResumeEvidence = (resumeEvidence, canonicalRole, leadershipItems = []) => {
  const projects = resumeEvidence.projects.evaluatedProjects || [];
  const roleWeights = ROLE_WEIGHTS[canonicalRole] || ROLE_WEIGHTS["Software Development Engineer"];
  const candidates = [];
  const categories = new Set(projects.flatMap((project) => Object.entries(project.capabilities)
    .filter(([, exists]) => exists)
    .map(([category]) => category)));

  categories.forEach((category) => {
    const supporting = projects.filter((project) => project.capabilities[category]);
    if (!supporting.length || !GENERIC_PRIORITY[category]) return;
    const methods = [...new Set(supporting.flatMap((project) => project.methods || []))];
    const technologies = [...new Set(supporting.flatMap((project) => project.technologies || []))];
    const outcomes = [...new Set(supporting.flatMap((project) => project.outcomeIndicators || []))];
    const evidenceTerms = [...new Set(supporting.flatMap((project) => (project.evidence || [])
      .filter((item) => item.category === category)
      .flatMap((item) => item.facts || [])))];
    const score = (roleWeights[category] || 0) * 10
      + GENERIC_PRIORITY[category] * 3
      + Math.min(supporting.length, 3) * 4
      + Math.min(methods.length, 4) * 3
      + Math.min(outcomes.length, 2) * 4
      + (supporting.some((project) => project.capabilities.deployment) ? 3 : 0);

    candidates.push({
      type: factType(category),
      category,
      projectNames: supporting.map((project) => project.name),
      projectCount: supporting.length,
      technologies,
      methods,
      evidenceTerms,
      outcomes,
      score
    });
  });

  projects.filter((project) => project.capabilities.frontend && project.capabilities.backend).forEach((project) => {
    candidates.push({
      type: "full_stack_project",
      category: "fullStack",
      projectNames: [project.name],
      projectCount: 1,
      technologies: project.technologies,
      methods: project.methods,
      outcomes: project.outcomeIndicators,
      score: (roleWeights.frontend || 0) * 7 + (roleWeights.backend || 0) * 7 + 25
    });
  });

  const leadershipEvidence = leadershipItems.length
    ? leadershipItems
    : (resumeEvidence.leadership?.exists ? [resumeEvidence.leadership] : []);
  leadershipEvidence.forEach((leadership) => {
    candidates.push({
      type: "leadership",
      category: "leadership",
      role: leadership.role,
      organization: leadership.organization,
      score: 18
    });
  });

  if (resumeEvidence.hasGitHub) candidates.push({ type: "github_presence", category: "github", exists: true, score: 8 });

  const rankedCandidates = candidates.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
  const selectedStrengths = [];
  for (const candidate of rankedCandidates) {
    if (selectedStrengths.length >= 6) break;
    const mlGroup = ["machineLearning", "recommendationSystem", "featureEngineering", "dataPreprocessing"];
    if (mlGroup.includes(candidate.category) && selectedStrengths.some((item) => mlGroup.includes(item.category))) continue;
    if (["frontend", "backend"].includes(candidate.category)
      && canonicalRole === "Software Development Engineer"
      && selectedStrengths.some((item) => item.category === "fullStack")) continue;
    if (candidate.category === "frontend" || candidate.category === "backend") {
      const fullStackProjects = new Set(selectedStrengths.filter((item) => item.category === "fullStack").flatMap((item) => item.projectNames));
      if (candidate.projectNames?.every((name) => fullStackProjects.has(name))) continue;
    }
    if (!selectedStrengths.some((selected) => selected.category === candidate.category)) selectedStrengths.push(candidate);
  }

  const rankedProjects = [...projects].sort((a, b) => {
    const complexity = { Advanced: 3, Intermediate: 2, Basic: 1 };
    const scoreA = a.roleRelevance * 10 + (complexity[a.complexity] || 0) * 5 + a.complexityIndicators.length * 2 + a.outcomeIndicators.length * 3;
    const scoreB = b.roleRelevance * 10 + (complexity[b.complexity] || 0) * 5 + b.complexityIndicators.length * 2 + b.outcomeIndicators.length * 3;
    return scoreB - scoreA;
  });
  const strongestProject = rankedProjects[0] ? {
    name: rankedProjects[0].name,
    type: rankedProjects[0].type,
    reasons: rankedCandidates.filter((candidate) => candidate.projectNames?.includes(rankedProjects[0].name)).slice(0, 5).map((candidate) => candidate.category),
    roleRelevance: rankedProjects[0].roleRelevance
  } : null;

  const technicalEvidence = rankedCandidates.filter((candidate) => candidate.projectNames).map((candidate) => ({
    category: candidate.category,
    technologies: candidate.technologies,
    projectNames: candidate.projectNames,
    evidenceCount: candidate.projectCount,
    score: candidate.score
  }));

  return {
    rankedCandidates,
    selectedStrengths: selectedStrengths.map(compactStrengthFact),
    technicalEvidence,
    topEvidence: {
      strongestProject,
      strongestTechnicalEvidence: rankedCandidates.find((candidate) => candidate.projectNames) || null,
      strongestLeadership: leadershipEvidence[0] || null,
      strongestDeployment: rankedCandidates.find((candidate) => candidate.category === "deployment") || null,
      strongestMachineLearning: rankedCandidates.find((candidate) => candidate.category === "machineLearning") || null,
      strongestBackend: rankedCandidates.find((candidate) => candidate.category === "backend") || null,
      strongestFrontend: rankedCandidates.find((candidate) => candidate.category === "frontend") || null,
      strongestDatabase: rankedCandidates.find((candidate) => candidate.category === "databaseIntegration") || null
    }
  };
};

module.exports = { rankResumeEvidence };
