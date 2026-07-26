const prisma = require("../lib/prisma");
const geminiService = require("../services/geminiService");
const productionAnalysisService = require("../services/placementAnalysis/productionAnalysisService");
const { randomUUID } = require("node:crypto");
const { SCORE_MODEL_VERSION } = require("../services/placementAnalysis/scoreLedgerAdapter");
const { REASONING_MODEL_VERSION } = require("../services/placementAnalysis/analysisOrchestrator");
const { PRESENTATION_LANGUAGE_VERSION } = require("../services/placementAnalysis/analysisLanguageService");
const {
  GEMINI_EXTRACTION_VERSION,
  FALLBACK_EXTRACTION_VERSION,
  NO_RESUME_EXTRACTION_VERSION
} = require("../services/resumeExtraction/resumeExtractionService");
const {
  resumeHashFor,
  profileFingerprintFor,
  inputFingerprintFor,
  readSnapshot,
  readResumeExtraction,
  saveResumeExtraction,
  saveAnalysisSnapshot
} = require("../services/analysisPersistence/analysisSnapshotService");

const analysisResponse = ({ analysis, analysisV2 }, { profile, hasResumeUrl, hasResumeText }) => ({
  success: true,
  userFound: true,
  profileFound: true,
  resumeUploaded: hasResumeUrl,
  resumeTextAvailable: hasResumeText,
  analysis,
  analysisV2,
  profileData: {
    branch: profile.branch,
    year: profile.year,
    cgpa: profile.cgpa,
    companyType: profile.companyType,
    targetRole: profile.targetRole,
    skills: {
      dsa: profile.dsa,
      dbms: profile.dbms,
      os: profile.os,
      networks: profile.networks,
      aptitude: profile.aptitude,
      communication: profile.communication,
    },
    timeline: {
      preparationTimelineMonths: profile.preparationTimelineMonths,
      dailyStudyHours: profile.dailyStudyHours,
    },
    resumeAvailable: hasResumeText,
  }
});

// POST /api/ai/generate-analysis
const generateAnalysis = async (req, res) => {
  const requestId = req.get("X-Request-ID") || randomUUID();
  try {
    // 1. Extract the validated user ID from your authMiddleware payload
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User context identity missing from authentication payload.",
      });
    }

    // 2. Query Prisma for the User along with their structural PlacementProfile data
    const userWithProfile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        placementProfile: true,
      },
    });

    // 3. Handle data exceptions gracefully if user is completely missing
    if (!userWithProfile) {
      return res.status(404).json({
        success: false,
        userFound: false,
        profileFound: false,
        message: "No user account found matching token profile credentials.",
      });
    }

    const profile = userWithProfile.placementProfile;

    // 4. Handle Case where onboarding process was bypassed or profile table lacks entries
    if (!profile) {
      return res.status(404).json({
        success: true,
        userFound: true,
        profileFound: false,
        resumeUploaded: false,
        resumeTextAvailable: false,
        message: "User found, but onboarding parameter profile data records are missing.",
      });
    }

    // 5. Evaluate Case A vs Case B status flags dynamically based on your schema structure
    const hasResumeUrl = profile.resumeUrl !== null && profile.resumeUrl.trim() !== "";
    const hasResumeText = profile.resumeText !== null && profile.resumeText.trim() !== "";

    // 6. Package database entries into a clean structured profile data payload
    const packedProfileData = {
      branch: profile.branch,
      year: profile.year,
      cgpa: profile.cgpa,
      companyType: profile.companyType,
      targetRole: profile.targetRole,
      skills: {
        dsa: profile.dsa,
        dbms: profile.dbms,
        os: profile.os,
        networks: profile.networks,
        aptitude: profile.aptitude,
        communication: profile.communication,
      },
      timeline: {
        preparationTimelineMonths: profile.preparationTimelineMonths,
        dailyStudyHours: profile.dailyStudyHours,
      },
      resumeText: profile.resumeText, // Holds string data (Case A) or clean null (Case B)
      resumeHash: profile.resumeHash,
    };

    // 7. 🚀 DELEGATE PIPELINE TO SERVICE CORE: Keeps prompt engineering out of the controller
    const resumeHash = resumeHashFor(packedProfileData);
    const profileFingerprint = profileFingerprintFor(packedProfileData);
    const candidateExtractionVersions = hasResumeText
      ? [GEMINI_EXTRACTION_VERSION, FALLBACK_EXTRACTION_VERSION]
      : [NO_RESUME_EXTRACTION_VERSION];

    for (const extractionVersion of candidateExtractionVersions) {
      const inputFingerprint = inputFingerprintFor({
        profileFingerprint,
        resumeHash,
        extractionVersion,
        scoringVersion: SCORE_MODEL_VERSION,
        reasoningVersion: REASONING_MODEL_VERSION,
        languageVersion: PRESENTATION_LANGUAGE_VERSION
      });
      const cached = await readSnapshot(prisma, userId, inputFingerprint);
      if (cached) {
        console.info("Placement analysis snapshot reused", { requestId, userId, snapshotId: cached.snapshotId });
        return res.status(200).json(analysisResponse(cached, { profile, hasResumeUrl, hasResumeText }));
      }
    }

    console.info("Placement analysis request received", { requestId, userId });
    const reusedExtraction = hasResumeText
      ? await readResumeExtraction(prisma, {
          userId,
          resumeHash,
          extractionVersions: candidateExtractionVersions
        })
      : null;
    const result = await productionAnalysisService.analyzePlacementProfileV2(packedProfileData, {
      requestId,
      includeArtifacts: true,
      ...(reusedExtraction
        ? { dependencies: { extractResumeFacts: async () => reusedExtraction } }
        : {})
    });
    const inputFingerprint = inputFingerprintFor({
      profileFingerprint,
      resumeHash,
      extractionVersion: result.extraction.version,
      scoringVersion: SCORE_MODEL_VERSION,
      reasoningVersion: REASONING_MODEL_VERSION,
      languageVersion: PRESENTATION_LANGUAGE_VERSION
    });
    const extractionRecord = await saveResumeExtraction(prisma, {
      userId,
      resumeHash,
      extraction: result.extraction
    });
    const persisted = await saveAnalysisSnapshot(prisma, {
      userId,
      profileFingerprint,
      inputFingerprint,
      extraction: result.extraction,
      resumeExtractionId: extractionRecord?.id,
      result: { ...result, languageVersion: PRESENTATION_LANGUAGE_VERSION }
    });

    // 8. Return structured production JSON response format carrying the AI service output
    console.info("Placement analysis response returned", { requestId, userId });
    return res.status(200).json({
      success: true,
      userFound: true,
      profileFound: true,
      resumeUploaded: hasResumeUrl,
      resumeTextAvailable: hasResumeText,
      analysis: persisted.legacyAnalysis,
      analysisV2: persisted.analysisV2,
      profileData: {
        branch: profile.branch,
        year: profile.year,
        cgpa: profile.cgpa,
        companyType: profile.companyType,
        targetRole: profile.targetRole,
        skills: packedProfileData.skills,
        timeline: packedProfileData.timeline,
        resumeAvailable: hasResumeText,
      },
    });

  } catch (error) {
    console.error("Placement analysis request failed", {
      requestId,
      message: error.message
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving onboarding context profiles and generating AI analysis.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// GET /api/ai/test-gemini
const testGeminiConnection = async (req, res) => {
  try {
    // 🚀 Delegates directly to the isolated service hook
    const responseText = await geminiService.testConnection();
    
    return res.status(200).json({
      success: true,
      message: responseText,
    });
  } catch (error) {
    console.error("❌ Gemini API Connection Test Failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to establish validation handshake with Gemini nodes.",
    });
  }
};

module.exports = {
  generateAnalysis,
  testGeminiConnection,
};
