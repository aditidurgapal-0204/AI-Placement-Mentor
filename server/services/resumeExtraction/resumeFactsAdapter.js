"use strict";

const { CAPABILITIES } = require("../../contracts/resumeFacts.v1");

const titleCase = (value) => String(value || "unknown").replace(/(^|_)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
const verified = (value) => value === "verified";

const adaptProjects = (facts) => {
  const evaluatedProjects = (facts.projects || []).map((project) => {
    const capabilities = Object.fromEntries(CAPABILITIES.map((capability) => [capability, project.capabilities.includes(capability)]));
    return {
      name: project.name,
      technologies: [...project.technologies],
      unknownTechnologies: [],
      methods: [],
      evidence: [project.evidence.quote],
      complexity: titleCase(project.complexity),
      roleRelevance: titleCase(project.roleRelevance),
      capabilities: {
        ...capabilities,
        deployment: verified(project.deployment),
        cloud: verified(project.cloud),
        scalability: verified(project.scalability),
        testing: verified(project.testing)
      }
    };
  });
  const capabilities = Object.fromEntries(CAPABILITIES.map((capability) => [
    capability,
    evaluatedProjects.some((project) => project.capabilities[capability])
  ]));
  const highestComplexity = evaluatedProjects.some(({ complexity }) => complexity === "Advanced")
    ? "Advanced"
    : evaluatedProjects.some(({ complexity }) => complexity === "Intermediate") ? "Intermediate" : "Basic";
  return {
    projectCount: evaluatedProjects.length,
    evaluatedProjects,
    projectSummaries: evaluatedProjects.map(({ name, technologies, complexity, roleRelevance, capabilities }) => ({ name, technologies, complexity, roleRelevance, capabilities })),
    capabilities,
    deployment: evaluatedProjects.some((project) => project.capabilities.deployment),
    cloudExposure: evaluatedProjects.some((project) => project.capabilities.cloud),
    systemDesignExposure: evaluatedProjects.some((project) => project.capabilities.scalability || project.capabilities.distributedSystems),
    complexity: evaluatedProjects.length ? highestComplexity : "Basic",
    overallProjectQuality: highestComplexity === "Advanced" ? "High" : highestComplexity === "Intermediate" ? "Moderate" : "Low"
  };
};

const namesByKind = (items, kind) => (items || []).filter((item) => item.kind === kind).map(({ name }) => name);

const adaptResumeFactsToEngineEvidence = (facts) => {
  if (!facts) return null;
  const projects = adaptProjects(facts);
  const internship = (facts.experience || []).find((entry) => entry.kind === "internship");
  const leadership = facts.leadership?.[0];
  const activityItems = facts.activities || [];
  const hasGithub = (facts.portfolioLinks || []).some((entry) => entry.kind === "github");
  const certificationEntries = (facts.certifications || []).map(({ name }) => name);
  const leadershipItems = (facts.leadership || []).map((entry) => ({
    role: entry.name,
    organization: entry.organization || null,
    evidence: entry.evidence.quote
  }));
  return {
    canonicalProjectFacts: projects,
    leadershipItems,
    resumeEvidence: {
      internship: internship
        ? { exists: true, organization: internship.name, duration: null, relevance: "High" }
        : { exists: false, organization: null, duration: null, relevance: "Unknown" },
      leadership: leadership
        ? { exists: true, role: leadership.name, organization: leadership.organization || null }
        : { exists: false, role: null, organization: null },
      research: { exists: (facts.achievements || []).some((entry) => entry.kind === "research"), publicationType: null },
      certifications: { exists: certificationEntries.length > 0, count: certificationEntries.length },
      competitiveProgramming: { exists: (facts.achievements || []).some((entry) => entry.kind === "competitive_programming"), platformDetected: null },
      hackathons: { exists: (facts.achievements || []).some((entry) => entry.kind === "hackathon"), context: null },
      openSource: { exists: (facts.achievements || []).some((entry) => entry.kind === "open_source") },
      projects,
      hasGitHub: hasGithub,
      detectedTechnologies: [...new Set((facts.skills || []).map(({ name }) => name))],
      activities: {
        publicSpeaking: namesByKind(activityItems, "public_speaking"),
        societyParticipation: namesByKind(activityItems, "society_participation"),
        volunteering: namesByKind(activityItems, "volunteering"),
        measurableAchievements: namesByKind(activityItems, "achievement")
      },
      certificationEntries
    }
  };
};

module.exports = { adaptResumeFactsToEngineEvidence };
