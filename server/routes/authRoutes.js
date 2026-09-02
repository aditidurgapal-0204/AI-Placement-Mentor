console.log("Auth Routes Loaded");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { createHash } = require("node:crypto");

const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/authMiddleware");
const { signup } = require("../controllers/signupController");
const { dumpPdfExtraction } = require("../services/debug/resumeExtractionDump");
const { extractPdfTextFromBuffer } = require("../services/publicPdfTextExtractor");
const { config, isEmailConfigured } = require("../config/env");

const router = express.Router();

// =================================================================
// EMAIL UTILITIES & CONFIGURATIONS
// =================================================================
const createTransporter = () => isEmailConfigured() ? nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass }
}) : null;

// =================================================================
// LOCAL FILE UPLOAD (MULTER ENGINE) FOR STEP 5
// =================================================================
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid layout file format. Only PDFs are authorized.'), false);
  }
};

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

// =================================================================
// CORE AUTHENTICATION ENDPOINTS (SIGNUP, LOGIN, FORGOT)
// =================================================================
router.get("/test", (req, res) => {
  res.send("Auth Route Working");
});

router.post("/signup", signup);

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim() || !password || !password.trim()) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    if (!config.jwtSecret) return res.status(503).json({ message: "Authentication is temporarily unavailable." });
    const token = jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isOnboardingComplete: user.isOnboardingComplete,
        currentOnboardingStep: user.currentOnboardingStep,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (!config.passwordResetSecret || !isEmailConfigured()) {
      return res.status(503).json({ message: "Password reset email is temporarily unavailable." });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    const safeMessage = "If an account exists for that email, a reset link has been sent.";
    if (!user) return res.status(200).json({ message: safeMessage });

    const resetToken = jwt.sign(
      { userId: user.id, passwordVersion: createHash("sha256").update(user.password).digest("hex") },
      config.passwordResetSecret,
      { expiresIn: "15m" }
    );

    const resetLink = `${config.clientUrl}/reset-password/${encodeURIComponent(resetToken)}`;

    await createTransporter().sendMail({
      from: config.smtp.from,
      to: email.trim(),
      subject: "Reset Your Password",
      html: `
        <div style="font-family:sans-serif;">
          <h2>Password Reset</h2>
          <p>Click the button below to reset your password:</p>
          <a
            href="${resetLink}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#7c3aed;
              color:white;
              text-decoration:none;
              border-radius:8px;
            "
          >
            Reset Password
          </a>
          <p style="margin-top:20px;">
            This link expires in 15 minutes.
          </p>
        </div>
      `,
    });

    res.status(200).json({
      message: safeMessage,
    });

  } catch (error) {
    console.error("Password reset email request failed");
    res.status(500).json({
      message: "Password reset could not be started. Please try again later.",
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) return res.status(400).json({ message: "Reset token and new password are required." });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
      return res.status(400).json({ message: "Password must be at least 6 characters and include uppercase, lowercase and numeric characters." });
    }
    if (!config.passwordResetSecret) return res.status(503).json({ message: "Password reset is temporarily unavailable." });
    const payload = jwt.verify(token, config.passwordResetSecret);
    if (!payload?.userId || !payload?.passwordVersion) throw new Error("INVALID_RESET_TOKEN");
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    const currentVersion = user && createHash("sha256").update(user.password).digest("hex");
    if (!user || currentVersion !== payload.passwordVersion) throw new Error("INVALID_RESET_TOKEN");
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    return res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    if (error?.name === "TokenExpiredError" || error?.name === "JsonWebTokenError" || error?.message === "INVALID_RESET_TOKEN") {
      return res.status(400).json({ message: "This password reset link is invalid or has expired." });
    }
    console.error("Password reset completion failed");
    return res.status(500).json({ message: "Password reset could not be completed. Please try again later." });
  }
});

// =================================================================
// AUTHENTICATED USER PROFILE SYNC (WITH RELATIONAL PLACEMENT DATA)
// =================================================================
router.get("/profile", authMiddleware, async (req, res) => {
  try { 
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isOnboardingComplete: true,
        currentOnboardingStep: true,
        placementProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User profile not found." });
    }

    res.status(200).json({
      message: "Protected profile route loaded successfully.",
      user, 
    });
  } catch (error) {
    console.error("Profile route error:", error);
    res.status(500).json({ message: "Server error fetching user profile context." });
  }
});

// =================================================================
// PLACEMENT PROFILE ONBOARDING ENDPOINT (UPSERT HANDLER)
// =================================================================
router.post("/profile-setup", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; 
    const { branch, year, cgpa, companyType, targetRole } = req.body;

    if (!branch || !year || !cgpa || !companyType || !targetRole) {
      return res.status(400).json({
        message: "Missing parameters. All onboarding fields are required.",
      });
    }

    const updatedProfile = await prisma.placementProfile.upsert({
      where: { userId: userId },
      update: {
        branch,
        year,
        cgpa: parseFloat(cgpa), 
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

    res.status(200).json({
      message: "Placement profile synced smoothly across your devices!",
      profile: updatedProfile,
    });

  } catch (error) {
    console.error("Onboarding Database Write Error:", error);
    res.status(500).json({
      message: "Server failed to save placement configurations.",
    });
  }
});

// =================================================================
// STEP-BY-STEP ONBOARDING STEP RECORDER (SMART GATEWAY ENGINE)
// =================================================================
router.post("/save-onboarding-step", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; 
    const { step, stepData } = req.body; 

    if (!step || !stepData) {
      return res.status(400).json({ message: "Missing required step payload components." });
    }

    if (step === 1) {
      await prisma.placementProfile.upsert({
        where: { userId },
        update: {
          branch: stepData.branch || "",
          year: stepData.year || "",
          cgpa: stepData.cgpa ? parseFloat(stepData.cgpa) : 0.0,
          preparationTimelineMonths: stepData.preparationTimelineMonths ? parseInt(stepData.preparationTimelineMonths, 10) : undefined,
          dailyStudyHours: stepData.dailyStudyHours ? parseInt(stepData.dailyStudyHours, 10) : undefined,
        },
        create: {
          userId,
          branch: stepData.branch || "",
          year: stepData.year || "",
          cgpa: stepData.cgpa ? parseFloat(stepData.cgpa) : 0.0,
          companyType: "", targetRole: "",
          dsa: "", dbms: "", os: "", networks: "", aptitude: "", communication: "",
          preparationTimelineMonths: stepData.preparationTimelineMonths ? parseInt(stepData.preparationTimelineMonths, 10) : null,
          dailyStudyHours: stepData.dailyStudyHours ? parseInt(stepData.dailyStudyHours, 10) : null
        },
      });
    } 
    else if (step === 2) {
      await prisma.placementProfile.update({
        where: { userId },
        data: {
          companyType: stepData.companyType || "",
          targetRole: stepData.targetRole || "",
          preparationTimelineMonths: stepData.preparationTimelineMonths ? parseInt(stepData.preparationTimelineMonths, 10) : undefined,
          dailyStudyHours: stepData.dailyStudyHours ? parseInt(stepData.dailyStudyHours, 10) : undefined,
        },
      });
    }
    else if (step === 3) {
      await prisma.placementProfile.update({
        where: { userId },
        data: {
          dsa: stepData.dsa || "",
          dbms: stepData.dbms || "",
          os: stepData.os || "",
          networks: stepData.networks || "",
          aptitude: stepData.aptitude || "",
          communication: stepData.communication || "",
          preparationTimelineMonths: stepData.preparationTimelineMonths ? parseInt(stepData.preparationTimelineMonths, 10) : undefined,
          dailyStudyHours: stepData.dailyStudyHours ? parseInt(stepData.dailyStudyHours, 10) : undefined,
        },
      });
    }
    else if (step === 4) {
      await prisma.placementProfile.update({
        where: { userId },
        data: {
          preparationTimelineMonths: stepData.preparationTimelineMonths ? parseInt(stepData.preparationTimelineMonths, 10) : null,
          dailyStudyHours: stepData.dailyStudyHours ? parseInt(stepData.dailyStudyHours, 10) : null,
          // 🚀 Preserve Step 5 resume data if already existing
          resumeUrl: stepData.resumeUrl || undefined,
          resumeText: stepData.resumeText || undefined
        },
      });
    }

    let targetNextStep = 1;

    if (stepData.branch && stepData.year && stepData.cgpa) {
      targetNextStep = 2;
      if (stepData.companyType && stepData.targetRole) {
        targetNextStep = 3;
        if (stepData.dsa && stepData.dbms && stepData.os && stepData.networks && stepData.aptitude && stepData.communication) {
          targetNextStep = 4;
          if (stepData.preparationTimelineMonths && stepData.dailyStudyHours) {
            targetNextStep = 5; 
          }
        }
      }
    }

    const isFinished = false; 

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        currentOnboardingStep: targetNextStep,
        isOnboardingComplete: isFinished,
      },
    });

    res.status(200).json({
      success: true,
      currentOnboardingStep: updatedUser.currentOnboardingStep,
      isOnboardingComplete: updatedUser.isOnboardingComplete,
      message: "Step progress safely synchronized.",
    });

  } catch (error) {
    console.error("Step execution syncing runtime failure:", error);
    res.status(500).json({ message: "Internal server error saving step context data points." });
  }
});

// =================================================================
// 🚀 NEW: STEP 5 RESUME FILE HANDLER AND EXTRACTION SYSTEM
// =================================================================
router.post("/save-resume-step", authMiddleware, (req, res, next) => upload.single('resume')(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "The PDF must be 5 MB or smaller." });
  return res.status(400).json({ message: "The resume upload could not be processed." });
}), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isSkipped } = req.body; 
    
    let resumeUrl = null;
    let resumeText = null;

    // A. Parse and extract text only if file buffer transmission is detected
    if (req.file && isSkipped !== 'true') {
      resumeUrl = "processed-in-memory";
      resumeText = await extractPdfTextFromBuffer(req.file.buffer);

      try {
        dumpPdfExtraction({
          userId,
          originalName: req.file.originalname,
          resumeText,
          resumeUrl
        });
      } catch (dumpError) {
        console.warn("[resume-debug] PDF dump failed:", dumpError.message);
      }
    }

    await prisma.placementProfile.update({
      where: { userId },
      data: {
        resumeUrl: resumeUrl,
        resumeText: resumeText
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        currentOnboardingStep: 5,
        isOnboardingComplete: true // Marks setup as completely finished
      }
    });

    return res.status(200).json({
      success: true,
      currentOnboardingStep: updatedUser.currentOnboardingStep,
      isOnboardingComplete: updatedUser.isOnboardingComplete,
      message: "Onboarding framework profile saved successfully. AI plan context compiled."
    });

  } catch (error) {
    console.error("Step 5 transactional processing context baseline crash:", error);
    return res.status(500).json({ message: "Internal server error parsing file data." });
  }
});

module.exports = router;
