const { PrismaClient } = require("@prisma/client");
const geminiService = require("../services/geminiService");

const prisma = new PrismaClient();

// POST /api/ai/generate-analysis
const generateAnalysis = async (req, res) => {
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
    };

    // 7. 🚀 DELEGATE PIPELINE TO SERVICE CORE: Keeps prompt engineering out of the controller
    const aiAnalysisResult = await geminiService.analyzePlacementProfile(packedProfileData);

    // 8. Return structured production JSON response format carrying the AI service output
    return res.status(200).json({
      success: true,
      userFound: true,
      profileFound: true,
      resumeUploaded: hasResumeUrl,
      resumeTextAvailable: hasResumeText,
      analysis: aiAnalysisResult, // 🧠 Contains readinessScore, strengths, weaknesses, etc.
      profileData: {
        id: profile.id,
        branch: profile.branch,
        year: profile.year,
        cgpa: profile.cgpa,
        companyType: profile.companyType,
        targetRole: profile.targetRole,
        skills: packedProfileData.skills,
        timeline: packedProfileData.timeline,
        resumeText: profile.resumeText, 
        createdAt: profile.createdAt,
      },
    });

  } catch (error) {
    console.error("❌ Core Data Aggregation System Failure:", error);
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