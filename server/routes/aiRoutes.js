const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// POST /api/ai/generate-analysis
router.post('/generate-analysis', authMiddleware, async (req, res) => {
  try {
    // 1. Extract the validated user ID from your verified authMiddleware payload
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User context identity missing from authentication payload.",
      });
    }

    // 2. ⏳ KEEP TIMING ALIVE: Keep the 3.5-second lag so your premium loading animations complete smoothly
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // 3. Query Prisma for the User along with their structural PlacementProfile data
    const userWithProfile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        placementProfile: true,
      },
    });

    // 4. Handle account data exceptions gracefully
    if (!userWithProfile) {
      return res.status(404).json({
        success: false,
        userFound: false,
        profileFound: false,
        message: "No user account found matching token profile credentials.",
      });
    }

    const profile = userWithProfile.placementProfile;

    // 5. Handle case where onboarding process records are missing entirely
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

    // 6. Evaluate Case A vs Case B status flags dynamically based on database entries
    const hasResumeUrl = profile.resumeUrl !== null && profile.resumeUrl.trim() !== "";
    const hasResumeText = profile.resumeText !== null && profile.resumeText.trim() !== "";

    // 7. Output structured data format ready for future AI models
    return res.status(200).json({
      success: true,
      userFound: true,
      profileFound: true,
      resumeUploaded: hasResumeUrl,
      resumeTextAvailable: hasResumeText,
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
        resumeText: profile.resumeText, // Will return string (Case A) or null (Case B) perfectly
        createdAt: profile.createdAt,
      },
    });

  } catch (error) {
    console.error("❌ Core Data Aggregation System Failure:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error occurred while retrieving onboarding context profiles." 
    });
  }
});

module.exports = router;