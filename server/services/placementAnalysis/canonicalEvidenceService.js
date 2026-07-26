const { createHash } = require("node:crypto");

const CANONICAL_EVIDENCE_VERSION = "1.1";

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
};

const evidenceId = (descriptor) => `evidence-${createHash("sha256")
  .update(JSON.stringify(stableValue(descriptor)))
  .digest("hex").slice(0, 16)}`;

const cleanObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, child]) => child !== undefined)
);

const cleanText = (value, maximum = 120) => String(value || "")
  .replace(/https?:\/\/\S+|www\.\S+|\b(?:github|gitlab)\.com\/\S+/gi, " ")
  .replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
const uniqueText = (values, maximum = 80) => [...new Map((values || []).map((value) => {
  const cleaned = cleanText(value, maximum);
  return [cleaned.toLowerCase(), cleaned];
})).values()].filter(Boolean);
const normalizedProjectType = (value) => {
  const type = String(value || "").toLowerCase();
  if (type.includes("full stack")) return "full-stack";
  if (type.includes("frontend")) return "frontend";
  if (type.includes("backend")) return "backend";
  if (type.includes("machine learning") || type.includes("ai")) return "ai-ml";
  if (type.includes("data")) return "data";
  return "other";
};

const buildCanonicalEvidence = ({ profileData = {}, resumeEvidence = {}, resumeProvided } = {}) => {
  const evidence = [];
  const addEvidence = ({ domain, type, capability, value, status = "verified", confidence = 1, source, path, ordinal = 0 }) => {
    const descriptor = { domain, type, capability, value, source, path, ordinal };
    evidence.push(cleanObject({
      id: evidenceId(descriptor),
      domain,
      type,
      capability,
      value,
      verificationStatus: status,
      confidence,
      provenance: { source, path, ordinal }
    }));
  };

  const skills = profileData.skills || {};
  Object.entries(skills).forEach(([capability, value], ordinal) => {
    if (value === undefined || value === null || value === "") return;
    addEvidence({ domain: "profile", type: "skill_level", capability, value, source: "onboarding", path: `skills.${capability}`, ordinal });
  });

  [
    ["academic_context", "branch", profileData.branch],
    ["academic_context", "year", profileData.year],
    ["academic_performance", "cgpa", Number(profileData.cgpa)],
    ["placement_goal", "target_role", profileData.targetRole],
    ["placement_goal", "company_type", profileData.companyType],
    ["preparation_context", "timeline_months", Number(profileData.timeline?.preparationTimelineMonths)],
    ["preparation_context", "daily_study_hours", Number(profileData.timeline?.dailyStudyHours)]
  ].forEach(([type, capability, value], ordinal) => {
    if (value === undefined || value === null || value === "" || (typeof value === "number" && !Number.isFinite(value))) return;
    addEvidence({ domain: "profile", type, capability, value, source: "onboarding", path: capability, ordinal });
  });

  const isResumeProvided = typeof resumeProvided === "boolean"
    ? resumeProvided
    : typeof profileData.resumeText === "string" && profileData.resumeText.trim().length > 0;
  const projects = resumeEvidence.projects?.evaluatedProjects || [];

  if (isResumeProvided) {
    const seenProjectNames = new Set();
    projects.forEach((project, projectIndex) => {
      const displayName = cleanText(project.name, 100);
      const projectIdentity = displayName.toLowerCase();
      if (projectIdentity && seenProjectNames.has(projectIdentity)) return;
      if (projectIdentity) seenProjectNames.add(projectIdentity);
      const capabilities = Object.entries(project.capabilities || {}).filter(([, exists]) => exists).map(([capability]) => capability);
      const technologies = uniqueText(project.technologies, 40);
      if (displayName && !/^(?:projects?|tech(?:nical)? stack|github|live link)$/i.test(displayName)) addEvidence({
        domain: "resume",
        type: "project_evidence",
        capability: "project_identity",
        value: {
          projectKey: `project-${evidenceId({ displayName: displayName.toLowerCase(), projectIndex }).slice(-12)}`,
          displayName,
          projectType: normalizedProjectType(project.type),
          complexity: String(project.complexity || "basic").toLowerCase(),
          roleRelevance: String(project.roleRelevance || project.companyFit || "unknown").toLowerCase(),
          technologies,
          capabilities,
          evidenceQuality: String(project.complexity || "basic").toLowerCase() === "advanced" ? "high" : "medium",
          deploymentStatus: capabilities.includes("deployment") ? "verified" : "not_verified"
        },
        status: "supported", confidence: 0.9, source: "evaluated_project", path: `projects[${projectIndex}]`, ordinal: projectIndex
      });
      Object.entries(project.capabilities || {}).forEach(([capability, exists], ordinal) => {
        if (!exists) return;
        addEvidence({
          domain: "resume",
          type: "demonstrated_capability",
          capability,
          value: true,
          status: "supported",
          confidence: 0.85,
          source: "evaluated_project",
          path: `projects[${projectIndex}].capabilities.${capability}`,
          ordinal
        });
      });
      (project.methods || []).forEach((method, ordinal) => addEvidence({
        domain: "resume", type: "demonstrated_method", capability: "method_application", value: method,
        status: "supported", confidence: 0.9, source: "evaluated_project", path: `projects[${projectIndex}].methods`, ordinal
      }));
      (project.technologies || []).forEach((technology, ordinal) => addEvidence({
        domain: "resume", type: "technology_exposure", capability: "technology_usage", value: technology,
        status: "supported", confidence: 0.9, source: "evaluated_project", path: `projects[${projectIndex}].technologies`, ordinal
      }));
      if (project.complexity) addEvidence({
        domain: "resume", type: "evidence_depth", capability: "project_complexity", value: project.complexity,
        status: "supported", confidence: 0.8, source: "evaluated_project", path: `projects[${projectIndex}].complexity`, ordinal: projectIndex
      });
    });

    const resumeSignals = [
      [resumeEvidence.internship?.exists, "professional_experience", "internship", resumeEvidence.internship],
      [resumeEvidence.leadership?.exists, "responsibility_evidence", "leadership", resumeEvidence.leadership],
      [resumeEvidence.research?.exists, "research_evidence", "research", resumeEvidence.research],
      [resumeEvidence.openSource?.exists, "collaboration_evidence", "open_source", resumeEvidence.openSource],
      [resumeEvidence.competitiveProgramming?.exists, "practice_evidence", "competitive_programming", resumeEvidence.competitiveProgramming],
      [resumeEvidence.hackathons?.exists, "participation_evidence", "hackathon", resumeEvidence.hackathons],
      [resumeEvidence.hasGitHub === true, "portfolio_evidence", "code_portfolio", { exists: true }],
      [resumeEvidence.certifications?.exists, "learning_evidence", "certification", { count: resumeEvidence.certifications?.count || 0 }]
    ];
    resumeSignals.forEach(([exists, type, capability, value], ordinal) => {
      addEvidence(exists ? {
        domain: "resume", type, capability, value, status: "verified", confidence: 0.95,
        source: "resume_metrics", path: capability, ordinal
      } : {
        domain: "resume", type: "resume_evidence_status", capability, value: "not_detected",
        status: "verified", confidence: 0.9, source: "resume_metrics", path: capability, ordinal
      });
    });

    const activitySignals = [
      ["public_speaking", resumeEvidence.activities?.publicSpeaking],
      ["society_participation", resumeEvidence.activities?.societyParticipation],
      ["volunteering", resumeEvidence.activities?.volunteering],
      ["measurable_achievement", resumeEvidence.activities?.measurableAchievements],
      ["certification_detail", resumeEvidence.certificationEntries]
    ];
    activitySignals.forEach(([capability, values], groupIndex) => uniqueText(values, 160).forEach((value, ordinal) => addEvidence({
      domain: "resume", type: capability === "certification_detail" ? "learning_evidence" : "activity_evidence",
      capability,
      value: capability === "certification_detail"
        ? value.replace(/^(?:successfully\s+)?completed\s+/i, "").replace(/\s+(?:with\s+)?certificate\.?$/i, "").trim()
        : { exists: true },
      status: "supported", confidence: 0.85, source: "resume_metrics",
      path: `activities.${capability}`, ordinal: groupIndex * 100 + ordinal
    })));

    addEvidence({
      domain: "resume",
      type: "resume_evidence_status",
      capability: "technical_projects",
      value: projects.length > 0 ? "detected" : "not_detected",
      status: "verified",
      confidence: 0.95,
      source: "evaluated_project",
      path: "projects",
      ordinal: resumeSignals.length
    });

    if (projects.length > 0) {
      ["deployment", "cloud", "scalability"].forEach((capability, index) => {
        const detected = projects.some((project) => project.capabilities?.[capability]);
        addEvidence({
          domain: "resume", type: "resume_evidence_status", capability,
          value: detected ? "detected" : "not_detected", status: "supported", confidence: 0.85,
          source: "evaluated_project", path: `projects.capabilityCoverage.${capability}`, ordinal: resumeSignals.length + index + 1
        });
      });
    }
  }

  return {
    version: CANONICAL_EVIDENCE_VERSION,
    assessment: {
      resumeStatus: isResumeProvided ? "assessed" : "not_assessed",
      profileStatus: "assessed"
    },
    evidence
  };
};

module.exports = { CANONICAL_EVIDENCE_VERSION, buildCanonicalEvidence, evidenceId };
