const fs = require("fs");
const path = require("path");

const DEBUG_DIR = path.join(__dirname, "..", "..", "debug", "resume-extraction");

const ensureDebugDir = () => {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
};

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const writeTextFile = (filename, contents) => {
  ensureDebugDir();
  const filePath = path.join(DEBUG_DIR, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  console.info(`[resume-debug] wrote ${filePath}`);
  return filePath;
};

/**
 * Dump raw PDF text right after upload/parse.
 */
const dumpPdfExtraction = ({ userId, originalName, resumeText, resumeUrl }) => {
  const id = String(userId || "unknown").slice(0, 12);
  const filename = `pdf-raw-${id}-${stamp()}.txt`;
  const body = [
    "AI Placement Mentor — PDF raw extraction dump",
    `createdAt: ${new Date().toISOString()}`,
    `userId: ${userId || "unknown"}`,
    `originalName: ${originalName || "n/a"}`,
    `resumeUrl: ${resumeUrl || "n/a"}`,
    `characterCount: ${typeof resumeText === "string" ? resumeText.length : 0}`,
    `lineCount: ${typeof resumeText === "string" ? resumeText.split(/\r?\n/).length : 0}`,
    "",
    "===== RAW RESUME TEXT =====",
    resumeText || "(empty — no text extracted)",
    ""
  ].join("\n");

  return writeTextFile(filename, body);
};

/**
 * Dump structured facts after readiness parsing.
 */
const dumpStructuredExtraction = ({
  userId,
  targetRole,
  companyType,
  canonicalRole,
  resumeText,
  sections,
  projects,
  resumeEvidence,
  leadershipItems
}) => {
  const id = String(userId || "unknown").slice(0, 12);
  const filename = `structured-${id}-${stamp()}.txt`;
  const sectionSummary = Object.fromEntries(
    Object.entries(sections || {}).map(([key, value]) => [
      key,
      {
        present: Boolean(String(value || "").trim()),
        chars: String(value || "").length,
        preview: String(value || "").trim().slice(0, 240)
      }
    ])
  );

  const body = [
    "AI Placement Mentor — structured resume extraction dump",
    `createdAt: ${new Date().toISOString()}`,
    `userId: ${userId || "unknown"}`,
    `targetRole: ${targetRole || "n/a"}`,
    `canonicalRole: ${canonicalRole || "n/a"}`,
    `companyType: ${companyType || "n/a"}`,
    `resumeCharacterCount: ${typeof resumeText === "string" ? resumeText.length : 0}`,
    "",
    "===== DETECTED SECTIONS =====",
    JSON.stringify(sectionSummary, null, 2),
    "",
    "===== INTERNSHIP =====",
    JSON.stringify(resumeEvidence?.internship || null, null, 2),
    "",
    "===== LEADERSHIP =====",
    JSON.stringify(resumeEvidence?.leadership || null, null, 2),
    "",
    "===== LEADERSHIP ITEMS =====",
    JSON.stringify(leadershipItems || [], null, 2),
    "",
    "===== GITHUB / OPEN SOURCE / RESEARCH =====",
    JSON.stringify({
      hasGitHub: resumeEvidence?.hasGitHub,
      openSource: resumeEvidence?.openSource,
      research: resumeEvidence?.research,
      certifications: resumeEvidence?.certifications,
      certificationEntries: resumeEvidence?.certificationEntries,
      competitiveProgramming: resumeEvidence?.competitiveProgramming,
      hackathons: resumeEvidence?.hackathons,
      detectedTechnologies: resumeEvidence?.detectedTechnologies,
      activities: resumeEvidence?.activities
    }, null, 2),
    "",
    "===== PROJECTS =====",
    JSON.stringify(projects || null, null, 2),
    "",
    "===== RAW RESUME TEXT (same as DB resumeText) =====",
    resumeText || "(empty)",
    ""
  ].join("\n");

  return writeTextFile(filename, body);
};

module.exports = {
  DEBUG_DIR,
  dumpPdfExtraction,
  dumpStructuredExtraction
};
