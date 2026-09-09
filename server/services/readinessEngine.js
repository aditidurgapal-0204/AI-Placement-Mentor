/**
 * server/services/readinessEngine.js
 * PIPELINE ENTRY ORCHESTRATOR - PRODUCTION ARCHITECTURE FREELOCK
 */

const { normalizeRole } = require("./readiness/roleNormalizer");
const { getCompanyRules } = require("./readiness/companyRules");
const { evaluateProjects } = require("./readiness/projectEvaluator");
const { extractResumeMetrics } = require("./readiness/resumeParser");
const { calculateReadinessScoreBreakdown } = require("./readiness/scoreCalculator");
const { buildEvidenceLists } = require("./readiness/evidenceBuilder");
const { rankResumeEvidence } = require("./readiness/evidenceRanker");
const { extractLeadershipItems } = require("./readiness/structuredProjectEvidence");
const { buildAnalysisFacts } = require("./readiness/analysisFactsBuilder");
const { adaptScoreBreakdownToLedger } = require("./placementAnalysis/scoreLedgerAdapter");
const { detectSections } = require("./resume/sectionDetector");
const { dumpStructuredExtraction } = require("./debug/resumeExtractionDump");

const computeReadiness = (profileData) => {
  if (!profileData) {
    return { 
      readinessScore: 0, 
      profileWeaknesses: [], 
      resumeWeaknesses: [], 
      factualStrengths: [], 
      extractedMetrics: {} 
    };
  }

  // 1. Unified Normalization Configs Loading
  const canonicalRole = normalizeRole(profileData.targetRole);
  const { key: selectedCompanyKey, rules, isEliteTarget } = getCompanyRules(profileData.companyType); // ISSUE 1: Ingesting key directly, preventing double parsing
  
  // 2. Single-pass Project Extraction & Structural Evaluation
  const canonicalProjectFacts = evaluateProjects(profileData.resumeText, canonicalRole, selectedCompanyKey);
  const resumeEvidence = extractResumeMetrics(profileData.resumeText, canonicalProjectFacts);
  const leadershipItems = extractLeadershipItems(profileData.resumeText);
  const rankedEvidence = rankResumeEvidence(resumeEvidence, canonicalRole, leadershipItems);

  try {
    dumpStructuredExtraction({
      userId: profileData.userId || profileData.id || null,
      targetRole: profileData.targetRole,
      companyType: profileData.companyType,
      canonicalRole,
      resumeText: profileData.resumeText,
      sections: detectSections(profileData.resumeText || ""),
      projects: canonicalProjectFacts,
      resumeEvidence,
      leadershipItems
    });
  } catch (dumpError) {
    console.warn("[resume-debug] structured dump failed:", dumpError.message);
  }
  // 3. Quantitative Score Calculation Pass
  const scoreBreakdown = calculateReadinessScoreBreakdown(
    profileData.skills,
    profileData.timeline,
    profileData.cgpa,
    canonicalRole,
    rules,
    {
      ...resumeEvidence,
      resumeEvaluated: typeof profileData.resumeText === "string" && profileData.resumeText.trim().length > 0
    }
  );
  const readinessScore = scoreBreakdown.score;
  const scoreLedger = adaptScoreBreakdownToLedger(scoreBreakdown);

  // 4. Decoupled Evidence Splitting Pass
  const {
  profileStrengths,
  profileWeaknesses,
  resumeStrengths,
  resumeWeaknesses,
  strengthFacts,

  profileFacts,
  resumeFacts,

  extractedMetrics
} = buildEvidenceLists(
  profileData,
  resumeEvidence,
  rules,
  isEliteTarget,
  canonicalRole
);

// Merge profile and resume strengths into one array for Gemini
const factualStrengths = [
  ...profileStrengths,

  ...(resumeStrengths.capabilities || []),

  ...(resumeStrengths.achievements || []),

  ...(resumeStrengths.experience || [])
];

  const analysisFacts = buildAnalysisFacts({
    profileData,
    rankedCandidates: rankedEvidence.rankedCandidates,
    profileWeaknesses,
    resumeWeaknesses,
    resumeFacts,
    scoreBreakdown
  });

  return {
    readinessScore,

    profileWeaknesses,

    resumeWeaknesses,

    factualStrengths,

    strengthFacts: analysisFacts.strengthFacts,
    weaknessFacts: analysisFacts.weaknessFacts,
    scoreExplanation: analysisFacts.scoreExplanation,
    insightEvidence: analysisFacts.insightEvidence,

    resumeEvidenceModel: {
      projects: canonicalProjectFacts.evaluatedProjects,
      leadership: leadershipItems,
      technicalEvidence: rankedEvidence.technicalEvidence,
      certifications: resumeEvidence.certifications,
      certificationEntries: resumeEvidence.certificationEntries,
      activities: resumeEvidence.activities,
      research: resumeEvidence.research?.exists ? [resumeEvidence.research] : [],
      openSource: resumeEvidence.openSource?.exists ? [resumeEvidence.openSource] : []
    },

    rankedStrengthCandidates: rankedEvidence.rankedCandidates,
    topEvidence: rankedEvidence.topEvidence,

    profileFacts,

    resumeFacts,

    extractedMetrics,
    scoreBreakdown,
    scoreLedger
};
};

module.exports = { computeReadiness };
