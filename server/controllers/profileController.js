// server/controllers/profileController.js
const prisma = require("../lib/prisma");

exports.savePlacementProfile = async (req, res) => {
  try {
    const { userId, branch, year, cgpa, companyType, targetRole } = req.body;

    // 1. Validation check to eliminate accidental mobile network drops/empty fields
    if (!userId || !branch || !year || !cgpa || !companyType || !targetRole) {
      return res.status(400).json({
        success: false,
        message: "Missing parameters. All onboarding fields are required.",
      });
    }

    // 2. Upsert operation: Saves a new profile, or updates an existing one if they edit it
    const profile = await prisma.placementProfile.upsert({
      where: { userId: userId },
      update: {
        branch,
        year,
        cgpa: parseFloat(cgpa), // Convert string input safely to a float for PostgreSQL
        companyType,
        targetRole,
      },
      create: {
        userId,
        branch,
        year,
        cgpa: parseFloat(cgpa),
        companyType,
        targetRole,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Placement profile synced successfully across devices!",
      profile,
    });
  } catch (error) {
    console.error("Profile sync error details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while compiling placement parameters.",
    });
  }
};