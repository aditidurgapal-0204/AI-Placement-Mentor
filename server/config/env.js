const isProduction = process.env.NODE_ENV === "production";

const cleanUrl = (value, fallback) => String(value || fallback).trim().replace(/\/$/, "");

const config = {
  isProduction,
  port: Number.parseInt(process.env.PORT || "8000", 10),
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  jwtSecret: process.env.JWT_SECRET,
  passwordResetSecret: process.env.PASSWORD_RESET_SECRET,
  clientUrl: cleanUrl(process.env.CLIENT_URL, "http://localhost:3000"),
  corsOrigins: String(process.env.CORS_ORIGINS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => cleanUrl(origin, ""))
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM
  }
};

const validateConfig = () => {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }
  const required = ["DATABASE_URL", "GEMINI_API_KEY", "JWT_SECRET", "PASSWORD_RESET_SECRET"];
  if (isProduction) required.push("CLIENT_URL", "CORS_ORIGINS");
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  if (isProduction && (config.jwtSecret.length < 32 || config.passwordResetSecret.length < 32)) {
    throw new Error("JWT_SECRET and PASSWORD_RESET_SECRET must each be at least 32 characters in production.");
  }
  if (isProduction && config.corsOrigins.some((origin) => origin === "*")) {
    throw new Error("CORS_ORIGINS cannot contain '*' in production.");
  }
};

const isEmailConfigured = () => Boolean(
  config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from
);

module.exports = { config, validateConfig, isEmailConfigured };
