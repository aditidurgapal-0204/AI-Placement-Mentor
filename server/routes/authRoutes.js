console.log("Auth Routes Loaded");
const { PdfReader } = require("pdfreader");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const pdfParse = require('pdf-parse');
const path = require("path");
const fs = require("fs");

const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/authMiddleware");

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
console.log(process.env.EMAIL_USER);
console.log(process.env.EMAIL_PASS);

// =================================================================
// LOCAL FILE UPLOAD (MULTER ENGINE) FOR STEP 5
// =================================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/resumes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + req.user.userId + '-' + uniqueSuffix + '.pdf');
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid layout file format. Only PDFs are authorized.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

// =================================================================
// CORE AUTHENTICATION ENDPOINTS (SIGNUP, LOGIN, FORGOT)
// =================================================================
router.get("/test", (req, res) => {
  res.send("Auth Route Working");
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim() || !email || !email.trim() || !password || !password.trim()) {
      return res.status(400).json({
        message: "All fields (Full Name, Email, Password) are required and cannot be empty.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        currentOnboardingStep: 1,
        isOnboardingComplete: false
      },
    });

    const token = jwt.sign(
      { userId: newUser.id },
      "secretkey",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        isOnboardingComplete: false,
        currentOnboardingStep: 1
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

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
      "secretkey",
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
      "resetsecret",
      { expiresIn: "15m" }
    );

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

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
// 🚀 NEW: STEP 5 RESUME FILE HANDLER AND EXTRACTION SYSTEM
// =================================================================
router.post("/save-resume-step", authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isSkipped } = req.body; 
    
    let resumeUrl = null;
    let resumeText = null;

    // A. Parse and extract text only if file buffer transmission is detected
    if (req.file && isSkipped !== 'true') {
      resumeUrl = `/uploads/resumes/${req.file.filename}`;
      
      const textRows = [];
      await new Promise((resolve, reject) => {
    
        new PdfReader().parseFileItems(req.file.path, (err, item) => {
          if (err) {
            reject(err);
          } else if (!item) {
            resolve(true); // End of file reached cleanly
          } else if (item.text) {
            textRows.push(item.text);
          }
        });
      });

      resumeText = textRows.join(" ").trim();
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
    return res.status(500).json({ message: error.message || "Internal server error parsing file data." });
  }
});

module.exports = router;