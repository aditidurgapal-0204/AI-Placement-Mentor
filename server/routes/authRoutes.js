console.log("Auth Routes Loaded");
const { PdfReader } = require("pdfreader");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { put } = require("@vercel/blob");

const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/authMiddleware");
const { signup } = require("../controllers/signupController");
const { dumpPdfExtraction } = require("../services/debug/resumeExtractionDump");

const router = express.Router();

// =================================================================
// EMAIL UTILITIES & CONFIGURATIONS
// =================================================================
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  auth: {
    user: "curtis38@ethereal.email",
    pass: "CCeTqF48dk8uWc4PfD",
  },
});

// =================================================================
// IN-MEMORY UPLOAD (MULTER) FOR STEP 5 — file goes to Vercel Blob
// =================================================================
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Invalid layout file format. Only PDFs are authorized."), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
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

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "secretkey",
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

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_RESET_SECRET || "resetsecret",
      { expiresIn: "15m" }
    );

    const resetLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
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

    console.log(
      "Preview URL:",
      nodemailer.getTestMessageUrl(info)
    );

    res.status(200).json({
      message: "Reset email sent successfully",
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
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
// 🚀 STEP 5 RESUME FILE HANDLER — uploads to Vercel Blob
// =================================================================
router.post("/save-resume-step", authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isSkipped } = req.body;

    let resumeUrl = null;
    let resumeText = null;

    // A. Upload to Vercel Blob + extract text only if a file was transmitted
    if (req.file && isSkipped !== 'true') {
      // Upload buffer directly to Vercel Blob — returns a permanent CDN URL
      const blobResult = await put(
        `resumes/${userId}-${Date.now()}.pdf`,
        req.file.buffer,
        { access: "public", contentType: "application/pdf" }
      );
      resumeUrl = blobResult.url;

      // Extract text from in-memory buffer (no disk path needed)
      const rows = {};
      await new Promise((resolve, reject) => {
        new PdfReader().parseBuffer(req.file.buffer, (err, item) => {
          if (err) { reject(err); return; }
          if (!item) { resolve(true); return; }
          if (item.text) {
            const y = item.y.toFixed(1);
            if (!rows[y]) rows[y] = [];
            rows[y].push({ x: item.x, text: item.text });
          }
        });
      });

      // Reconstruct lines in reading order
      resumeText = Object.keys(rows)
        .sort((a, b) => parseFloat(a) - parseFloat(b))
        .map(y =>
          rows[y]
            .sort((a, b) => a.x - b.x)
            .map(i => i.text)
            .join(" ")
        )
        .join("\n");

      try {
        dumpPdfExtraction({
          userId,
          originalName: req.file.originalname,
          resumeText,
          resumeUrl,
        });
      } catch (dumpError) {
        console.warn("[resume-debug] PDF dump failed:", dumpError.message);
      }
    }

    await prisma.placementProfile.update({
      where: { userId },
      data: {
        resumeUrl: resumeUrl,
        resumeText: resumeText,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        currentOnboardingStep: 5,
        isOnboardingComplete: true,
      },
    });

    return res.status(200).json({
      success: true,
      currentOnboardingStep: updatedUser.currentOnboardingStep,
      isOnboardingComplete: updatedUser.isOnboardingComplete,
      message: "Onboarding framework profile saved successfully. AI plan context compiled.",
    });

  } catch (error) {
    console.error("Step 5 transactional processing context baseline crash:", error);
    return res.status(500).json({ message: error.message || "Internal server error parsing file data." });
  }
});

module.exports = router;

