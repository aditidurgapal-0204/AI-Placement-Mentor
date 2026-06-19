const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const generateAnalysis = async (req, res) => {
  try {
    // 1. Extract the validated user ID from your authMiddleware payload
    const userId = req.user.id;

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

    // 6. Return structured production JSON response format
    return res.status(200).json({
      success: true,
      userFound: true,
      profileFound: true,
      resumeUploaded: hasResumeUrl,         // True if url string exists
      resumeTextAvailable: hasResumeText,   // True if text is populated
      profileData: {
        id: profile.id,
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
        // Injected cleanly or returned as null depending on user's action
        resumeText: profile.resumeText, 
        createdAt: profile.createdAt,
      },
    });

  } catch (error) {
    console.error("❌ Core Data Aggregation System Failure:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving onboarding context profiles.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  generateAnalysis,
};