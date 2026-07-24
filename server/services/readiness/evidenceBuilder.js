/**
 * server/services/readiness/evidenceBuilder.js
 * Builds structured evidence for Gemini.
 * This file DOES NOT calculate readiness.
 * It only separates facts into strengths, weaknesses and neutral observations.
 */

const { profileThresholds } = require("../../configs/evidenceRules");

const buildEvidenceLists = (
  profileData,
  resumeEvidence,
  companyRules,
  isEliteTarget,
  canonicalRole = "Software Development Engineer"
) => {

  const profileStrengths = [];
  const profileWeaknesses = [];

  const resumeStrengths = {
    capabilities: [],
    achievements: [],
    experience: []
};
  const resumeWeaknesses = [];
  const strengthFacts = [];

  const skills = profileData.skills || {};
  const timeline = profileData.timeline || {};

  const cgpa = parseFloat(profileData.cgpa);
  const months = parseInt(timeline.preparationTimelineMonths);

  //--------------------------------------------------
  // DSA
  //--------------------------------------------------

  switch ((skills.dsa || "").toLowerCase()) {

    case "advanced":
      profileStrengths.push("Advanced Data Structures & Algorithms");
      break;

    case "beginner":
      profileWeaknesses.push("Beginner-level Data Structures & Algorithms");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // DBMS
  //--------------------------------------------------

  switch ((skills.dbms || "").toLowerCase()) {

    case "advanced":
      profileStrengths.push("Advanced Database Management Systems");
      break;

    case "beginner":
      profileWeaknesses.push("Beginner-level Database Management Systems");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // Operating Systems
  //--------------------------------------------------

  switch ((skills.os || "").toLowerCase()) {

    case "advanced":
      profileStrengths.push("Advanced Operating Systems");
      break;

    case "beginner":
      profileWeaknesses.push("Beginner-level Operating Systems");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // Computer Networks
  //--------------------------------------------------

  switch ((skills.networks || "").toLowerCase()) {

    case "advanced":
      profileStrengths.push("Advanced Computer Networks");
      break;

    case "beginner":
      profileWeaknesses.push("Beginner-level Computer Networks");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // Aptitude
  //--------------------------------------------------

  switch ((skills.aptitude || "").toLowerCase()) {

    case "advanced":
      profileStrengths.push("Strong Quantitative Aptitude");
      break;

    case "beginner":
      profileWeaknesses.push("Weak Quantitative Aptitude");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // Communication
  //--------------------------------------------------

  switch ((skills.communication || "").toLowerCase()) {

    case "strong":
      profileStrengths.push("Strong Communication Skills");
      break;

    case "weak":
      profileWeaknesses.push("Weak Communication Skills");
      break;

    default:
      break;
  }

  //--------------------------------------------------
  // CGPA
  //--------------------------------------------------

  if (
    !isNaN(cgpa) &&
    cgpa >= profileThresholds.cgpa.exceptionalStandingLimit
  ) {
    profileStrengths.push(`Excellent CGPA (${cgpa})`);
  }

  if (
    !isNaN(cgpa) &&
    cgpa < profileThresholds.cgpa.severeCutoffZone
  ) {
    profileWeaknesses.push(`Low CGPA (${cgpa})`);
  }

  //--------------------------------------------------
  // Resume Evaluation
  //--------------------------------------------------

  const resumeEvaluated = !!profileData.resumeText;

  if (resumeEvaluated) {

    const projects = resumeEvidence.projects;

    if (!resumeEvidence.internship.exists) {
      resumeWeaknesses.push("No internship experience");
    }

    if (!resumeEvidence.hasGitHub) {
      resumeWeaknesses.push("GitHub profile not found");
    }

    if (projects.projectCount === 0) {

  resumeWeaknesses.push("No technical projects");

} else {

  const capabilities = projects.capabilities;

  // ---------------- Weaknesses ----------------

  if (!capabilities.deployment) {
    resumeWeaknesses.push(
      "deploymentMissing"
    );
  }

  if (["Software Development Engineer", "Backend Developer", "ML Engineer"].includes(canonicalRole) && !capabilities.cloud) {
    resumeWeaknesses.push(
      "cloudMissing"
    );
  }

  if (
    isEliteTarget && ["Software Development Engineer", "Backend Developer"].includes(canonicalRole) &&
    !capabilities.scalability
  ) {
    resumeWeaknesses.push(
      "scalabilityMissing"
    );
  }

  if (
    projects.complexity === "Basic" &&
    isEliteTarget
  ) {
    resumeWeaknesses.push(
      "projectComplexityLow"
    );
  }
}
}

  return {
  profileStrengths,
profileWeaknesses,
resumeStrengths,
resumeWeaknesses,
strengthFacts,

  profileFacts: {
    skills: profileData.skills,
    cgpa,
    timelineMonths: months,
    targetRole: profileData.targetRole,
    companyType: profileData.companyType
  },

  resumeFacts:{

    internship:resumeEvidence.internship,

    leadership:resumeEvidence.leadership,

    research:resumeEvidence.research,

    competitiveProgramming:resumeEvidence.competitiveProgramming,

    hackathons:resumeEvidence.hackathons,

    openSource:resumeEvidence.openSource,

    github:resumeEvidence.hasGitHub,

    certifications:resumeEvidence.certifications,

    detectedTechnologies:resumeEvidence.detectedTechnologies,

    projects:{

        count:resumeEvidence.projects.projectCount,

        complexity:resumeEvidence.projects.complexity,

        quality:resumeEvidence.projects.overallProjectQuality,

        capabilities:resumeEvidence.projects.capabilities,

        summaries: resumeEvidence.projects.projectSummaries,
    }
},

  extractedMetrics: {
    resumeEvaluated,
    timelineMonths: months,
    dailyStudyHours: Number(profileData.timeline?.dailyStudyHours)
  }

};
};
module.exports = { buildEvidenceLists };
