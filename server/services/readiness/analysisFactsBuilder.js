const NEXT_LEVELS = [25, 50, 70, 85, 100];

const unique = (values) => [...new Set(values.filter(Boolean))];
const sum = (values) => values.reduce((total, value) => total + value, 0);

const contributionPoints = (scoreBreakdown, predicate) => sum(
  scoreBreakdown.contributions.filter(({ source }) => predicate(source)).map(({ points }) => points)
);

const clusterTechnicalEvidence = (rankedCandidates, scoreBreakdown) => {
  const candidates = rankedCandidates.filter((candidate) => candidate.projectNames?.length);
  const remaining = new Set(candidates);
  const clusters = [];

  for (const seed of candidates) {
    if (!remaining.has(seed)) continue;
    const seedProjects = new Set(seed.projectNames);
    const related = candidates.filter((candidate) => remaining.has(candidate)
      && candidate.projectNames.some((project) => seedProjects.has(project)));
    related.forEach((candidate) => remaining.delete(candidate));

    const ranked = related.sort((a, b) => b.score - a.score);
    const capabilities = unique(ranked.map((candidate) => candidate.category)).slice(0, 4);
    const supportingProjects = unique(ranked.flatMap((candidate) => candidate.projectNames));
    clusters.push({
      id: `technical-capability-${clusters.length + 1}`,
      type: "demonstratedTechnicalCapability",
      focus: capabilities[0],
      evidenceStrength: {
        supportingProjectCount: supportingProjects.length,
        verifiedCapabilityCount: unique(ranked.map((candidate) => candidate.category)).length,
        verifiedMethodCount: unique(ranked.flatMap((candidate) => candidate.methods || [])).length,
        verifiedOutcomeCount: unique(ranked.flatMap((candidate) => candidate.outcomes || [])).length
      },
      relevance: Math.max(...ranked.map((candidate) => candidate.score)),
      readinessImpact: contributionPoints(scoreBreakdown, (source) => source === "resume.projects"
        || capabilities.some((capability) => source === `resume.${capability}`)),
      evidenceRefs: { projectRefs: supportingProjects, verifiedCapabilities: capabilities }
    });
  }

  return clusters.sort((a, b) => b.relevance - a.relevance);
};

const buildPositiveInsights = ({ profileData, rankedCandidates, resumeFacts, scoreBreakdown }) => {
  const insights = clusterTechnicalEvidence(rankedCandidates, scoreBreakdown);
  const profileSkillImpact = sum(scoreBreakdown.positiveContributions
    .filter(({ source }) => source.startsWith("profile.") && !["profile.cgpa", "profile.timeline"].includes(source))
    .map(({ points }) => points));
  const positiveProfileDimensions = scoreBreakdown.positiveContributions
    .filter(({ source }) => source.startsWith("profile.") && !["profile.cgpa", "profile.timeline"].includes(source)).length;

  if (positiveProfileDimensions) insights.push({
    id: "placement-foundation",
    type: "placementPreparationFoundation",
    evidenceStrength: { positivePreparationDimensions: positiveProfileDimensions },
    readinessImpact: Math.max(0, profileSkillImpact)
  });

  const cgpaImpact = contributionPoints(scoreBreakdown, (source) => source === "profile.cgpa");
  if (cgpaImpact > 0) insights.push({
    id: "academic-consistency",
    type: "academicConsistency",
    evidenceStrength: { verified: true },
    readinessImpact: cgpaImpact
  });

  const timelineImpact = contributionPoints(scoreBreakdown, (source) => source === "profile.timeline");
  if (timelineImpact > 0) insights.push({
    id: "preparation-capacity",
    type: "preparationCapacity",
    evidenceStrength: {
      timelineMonths: Number(profileData.timeline?.preparationTimelineMonths),
      dailyStudyHours: Number(profileData.timeline?.dailyStudyHours)
    },
    readinessImpact: timelineImpact
  });

  const verifiedSignals = [
    [resumeFacts.internship?.exists, "professionalExperience"],
    [resumeFacts.leadership?.exists, "leadershipResponsibility"],
    [resumeFacts.research?.exists, "researchPractice"],
    [resumeFacts.openSource?.exists, "collaborativeContribution"],
    [Number(resumeFacts.certifications?.count || resumeFacts.certifications?.length || 0) > 0, "continuedLearning"],
    [resumeFacts.github === true, "verifiableTechnicalPortfolio"]
  ].filter(([exists]) => exists).map(([, capability]) => capability);

  if (verifiedSignals.length) insights.push({
    id: "professional-evidence",
    type: "professionalEvidence",
    focus: verifiedSignals.length > 1 ? "professionalEvidenceBreadth" : verifiedSignals[0],
    evidenceStrength: { verifiedSignalCount: verifiedSignals.length },
    readinessImpact: contributionPoints(scoreBreakdown, (source) => source === "resume.leadership"),
    evidenceRefs: { verifiedSignals }
  });

  return insights
    .map((insight) => ({ ...insight, priority: insight.relevance || insight.readinessImpact || insight.evidenceStrength.verifiedSignalCount || 0 }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
};

const gapGroup = (category) => {
  if (["deploymentMissing", "cloudMissing", "scalabilityMissing"].includes(category)) return "productionReadiness";
  if (["projectComplexityLow", "No technical projects"].includes(category)) return "demonstratedTechnicalDepth";
  if (category === "No internship experience") return "professionalExposure";
  if (category === "GitHub profile not found") return "portfolioVerifiability";
  return "resumeEvidenceDepth";
};

const buildGapInsights = ({ profileWeaknesses, resumeWeaknesses, scoreBreakdown }) => {
  const gaps = [];
  const profilePenalty = Math.abs(sum(scoreBreakdown.negativeContributions
    .filter(({ source }) => source.startsWith("profile.") && source !== "profile.timeline")
    .map(({ points }) => points)));
  if (profileWeaknesses.length) gaps.push({
    id: "core-preparation-depth",
    type: "corePreparationDepth",
    reason: "verifiedProfileLevelsBelowTarget",
    evidenceStrength: { affectedDimensionCount: profileWeaknesses.length },
    readinessImpact: profilePenalty || profileWeaknesses.length * 2,
    blocks: "consistentPerformanceInRoleScreening"
  });

  const timelinePenalty = Math.abs(contributionPoints(scoreBreakdown, (source) => source === "profile.timeline"));
  if (timelinePenalty) gaps.push({
    id: "preparation-runway",
    type: "preparationRunway",
    reason: "limitedTimeForVerifiedImprovement",
    readinessImpact: timelinePenalty,
    blocks: "completionOfHighestPriorityPreparation"
  });

  const targetPenalty = Math.abs(contributionPoints(scoreBreakdown, (source) => source === "company.requiredSkills"));
  if (targetPenalty) gaps.push({
    id: "target-alignment",
    type: "targetRoleAlignment",
    reason: "verifiedRequirementsNotYetMet",
    readinessImpact: targetPenalty,
    blocks: "readinessForSelectedCompanyContext"
  });

  const groupedResumeGaps = new Map();
  resumeWeaknesses.forEach((category) => {
    const group = gapGroup(category);
    groupedResumeGaps.set(group, (groupedResumeGaps.get(group) || 0) + 1);
  });
  const baseImpact = { demonstratedTechnicalDepth: 9, professionalExposure: 8, productionReadiness: 7, portfolioVerifiability: 4, resumeEvidenceDepth: 4 };
  groupedResumeGaps.forEach((count, type) => gaps.push({
    id: `gap-${type}`,
    type,
    reason: "insufficientVerifiedRoleEvidence",
    evidenceStrength: { relatedGapCount: count },
    readinessImpact: baseImpact[type] + count,
    blocks: "strongerRecruiterConfidence"
  }));

  return gaps.sort((a, b) => b.readinessImpact - a.readinessImpact).slice(0, 6);
};

const stripInternalEvidence = (insight) => {
  const { evidenceRefs, relevance, priority, ...publicInsight } = insight;
  return publicInsight;
};

const buildAnalysisFacts = ({ profileData, rankedCandidates, profileWeaknesses, resumeWeaknesses, resumeFacts, scoreBreakdown }) => {
  const internalStrengths = buildPositiveInsights({ profileData, rankedCandidates, resumeFacts, scoreBreakdown });
  const weaknesses = buildGapInsights({ profileWeaknesses, resumeWeaknesses, scoreBreakdown });
  const nextLevel = NEXT_LEVELS.find((level) => level > scoreBreakdown.score) || 100;
  const totalPositiveImpact = sum(scoreBreakdown.positiveContributions.map(({ points }) => points));
  const totalNegativeImpact = sum(scoreBreakdown.negativeContributions.map(({ points }) => points));

  return {
    strengthFacts: internalStrengths.map(stripInternalEvidence),
    weaknessFacts: weaknesses,
    insightEvidence: Object.fromEntries(internalStrengths.filter((insight) => insight.evidenceRefs)
      .map((insight) => [insight.id, insight.evidenceRefs])),
    scoreExplanation: {
      score: scoreBreakdown.score,
      totalPositiveImpact,
      totalNegativeImpact,
      strongestDrivers: internalStrengths.slice(0, 3).map(({ id, type, readinessImpact = 0 }) => ({ insightId: id, type, readinessImpact })),
      highestImpactBlockers: weaknesses.slice(0, 3).map(({ id, type, readinessImpact }) => ({ insightId: id, type, readinessImpact })),
      nextReadinessLevel: nextLevel,
      pointsToNextLevel: Math.max(0, nextLevel - scoreBreakdown.score),
      whyNotNextLevel: weaknesses.slice(0, 2).map(({ id }) => id),
      firstPriority: weaknesses[0]?.id || null,
      rule: "deterministic verified contributions, rounded and bounded from zero to one hundred"
    }
  };
};

module.exports = { buildAnalysisFacts };