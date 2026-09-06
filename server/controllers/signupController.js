const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

const signup = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!name || !email || !password.trim()) {
      return res.status(400).json({ message: "Full name, email and password are required." });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    if (!PASSWORD_PATTERN.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters and include uppercase, lowercase and numeric characters."
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        currentOnboardingStep: 1,
        isOnboardingComplete: false
      }
    });

    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );
    return res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        isOnboardingComplete: false,
        currentOnboardingStep: 1
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Signup request failed", { name: error.name, code: error.code, message: error.message, stack: error.stack });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (error.name === "PrismaClientInitializationError" || ["P1000", "P1001", "P1002", "P1017", "P2024"].includes(error.code)) {
      return res.status(503).json({ message: "Signup is temporarily unavailable. Please try again shortly." });
    }
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
};

module.exports = { signup };
