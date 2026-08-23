const { createHash } = require("node:crypto");
const { normalizeRole } = require("./readiness/roleNormalizer");
const { normalizeRoadmap, MIN_MONTHS, MAX_MONTHS } = require("../contracts/roadmap.v1");
const geminiService = require("./geminiService");

const LEVEL = { beginner: 0, basic: 0, average: 1, intermediate: 1, strong: 2, advanced: 2 };
const ROLE_TOPICS = {
  "Software Development Engineer": ["DSA patterns", "OOP", "DBMS", "Operating Systems", "Computer Networks", "coding rounds", "system design basics"],
  "Backend Developer": ["DSA patterns", "APIs", "databases", "backend architecture", "testing", "deployment", "system design basics"],
  "ML Engineer": ["Python", "statistics", "data preprocessing", "ML fundamentals", "model evaluation", "SQL", "ML projects", "DSA fundamentals"],
  "Data Analyst": ["SQL", "spreadsheets and data handling", "statistics", "Python analysis", "data visualization", "case studies", "portfolio projects"],
  "Frontend Developer": ["JavaScript", "React", "web fundamentals", "API integration", "frontend performance", "testing", "frontend projects", "DSA fundamentals"]
};

const level = (value) => LEVEL[String(value || "").trim().toLowerCase()] ?? 0;
const unique = (values) => [...new Set(values.filter(Boolean))];
const workload = (hours) => Number(hours) <= 1 ? { problems: 15, mocks: 1, scope: 4 }
  : Number(hours) >= 5 ? { problems: 55, mocks: 3, scope: 7 }
    : Number(hours) >= 3 ? { problems: 35, mocks: 2, scope: 6 }
      : { problems: 25, mocks: 1, scope: 5 };

const profilePriorities = (profile) => {
  const role = normalizeRole(profile.targetRole);
  const skills = profile.skills || {};
  const labels = { dsa: "DSA", dbms: "DBMS", os: "Operating Systems", networks: "Computer Networks", aptitude: "Aptitude", communication: "Communication" };
  const weak = Object.entries(labels).filter(([key]) => level(skills[key]) === 0).map(([, label]) => label);
  const developing = Object.entries(labels).filter(([key]) => level(skills[key]) === 1).map(([, label]) => label);
  return { role, weak, developing, roleTopics: ROLE_TOPICS[role] || ROLE_TOPICS["Software Development Engineer"] };
};

const companyTopics = (companyType) => {
  const value = String(companyType || "").toLowerCase();
  if (/faang|product/.test(value)) return ["timed coding rounds", "CS fundamentals", "problem-solving patterns", "system design basics"];
  if (/startup/.test(value)) return ["practical project depth", "APIs and databases", "testing and deployment", "problem solving"];
  if (/service/.test(value)) return ["aptitude rounds", "programming fundamentals", "core CS revision", "technical and HR interviews"];
  return ["role-specific interviews", "mock interviews"];
};

const resumeTopics = (analysis, resumeProvided) => {
  if (!resumeProvided) return [];
  const text = JSON.stringify(analysis || {}).toLowerCase();
  const topics = [];
  if (/deploy|production|cloud/.test(text)) topics.push("project testing and deployment evidence");
  if (/github|portfolio|review your work/.test(text)) topics.push("GitHub portfolio and project README");
  if (/resume|evidence|technical depth|project/.test(text)) topics.push("resume project descriptions with measurable outcomes");
  if (/internship|professional exposure/.test(text)) topics.push("team contribution or practical engineering experience");
  return unique(topics).slice(0, 2);
};

const buildFallbackRoadmap = (profile, analysis) => {
  const months = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Number(profile.timeline?.preparationTimelineMonths) || 1));
  const dailyHours = Number(profile.timeline?.dailyStudyHours) || 1;
  const capacity = workload(dailyHours);
  const { role, weak, developing, roleTopics } = profilePriorities(profile);
  const employerTopics = companyTopics(profile.companyType);
  const evidenceTopics = resumeTopics(analysis, analysis?.context?.resumeProvided === true || profile.resumeAvailable === true);
  const priorities = unique([...weak, ...developing, ...roleTopics, ...employerTopics, ...evidenceTopics]);

  const roadmap = Array.from({ length: months }, (_, index) => {
    const month = index + 1;
    const ratio = month / months;
    const finalMonth = month === months;
    const early = ratio <= 0.34;
    const middle = !early && !finalMonth;
    const baseTopics = finalMonth
      ? unique(["targeted revision", ...employerTopics, "mock technical interviews", "resume and project explanations"])
      : early ? priorities.slice(0, capacity.scope)
        : unique([...priorities.slice(Math.max(1, index), index + capacity.scope - 1), ...roleTopics.slice(-2)]);
    const topics = unique([roleTopics[index % roleTopics.length], ...baseTopics]).slice(0, capacity.scope);
    while (topics.length < 2) topics.push(roleTopics[topics.length] || "role-specific fundamentals");

    const dsaNeedsWork = level(profile.skills?.dsa) < 2 && ["Software Development Engineer", "Backend Developer", "Frontend Developer"].includes(role);
    const goals = finalMonth
      ? [`Complete ${capacity.mocks} timed coding or role-specific mock test${capacity.mocks > 1 ? "s" : ""}.`, "Prepare concise technical explanations for the strongest projects and resume entries.", "Revise mistakes from mocks and repeat the weakest interview area."]
      : [
          dsaNeedsWork ? `Solve ${capacity.problems} level-appropriate DSA problems, recording patterns and mistakes.` : `Complete ${Math.max(2, Math.round(capacity.problems / 10))} focused exercises or case tasks for ${role}.`,
          `Finish one structured revision cycle covering ${topics.slice(0, 2).join(" and ")}.`,
          evidenceTopics.length && middle ? `Improve ${evidenceTopics[0]} without inventing unsupported experience.` : `Produce one demonstrable outcome from the month's role-specific practice.`
        ];
    const title = finalMonth ? "Placement and Interview Mode" : early ? "Priority Foundations" : middle ? "Role-Focused Depth" : "Interview Readiness";
    const focus = finalMonth
      ? `Convert ${role} preparation into consistent performance for ${profile.companyType || "target-company"} selection rounds.`
      : `Strengthen the highest-impact gaps for ${role} with a workload suited to ${dailyHours} hour${dailyHours === 1 ? "" : "s"} per day.`;
    return { month, title, focus, topics, goals };
  });
  return normalizeRoadmap({ source: "deterministic_fallback", roadmap }, months, role);
};

const fingerprintRoadmapInput = (profile, analysis) => createHash("sha256").update(JSON.stringify({
  branch: profile.branch, year: profile.year, cgpa: profile.cgpa, companyType: profile.companyType,
  targetRole: profile.targetRole, skills: profile.skills, timeline: profile.timeline,
  resumeAvailable: profile.resumeAvailable === true,
  analysis: {
    readiness: analysis?.readiness?.score,
    strengths: analysis?.strengths, scoreBlockers: analysis?.scoreBlockers,
    careerRisks: analysis?.careerRisks, firstPriority: analysis?.firstPriority
  }
})).digest("hex");

const generateRoadmap = async (profile, analysis, options = {}) => {
  const fallback = buildFallbackRoadmap(profile, analysis);
  const promptFacts = {
    profile: { branch: profile.branch, year: profile.year, cgpa: profile.cgpa, companyType: profile.companyType, targetRole: profile.targetRole, skills: profile.skills, timeline: profile.timeline, resumeAvailable: profile.resumeAvailable === true },
    existingAnalysis: analysis
  };
  const prompt = `Create a personalized month-wise placement roadmap from the verified facts below. Do not recalculate readiness, re-analyze a resume, invent achievements, or create daily/weekly tracking. Generate exactly ${fallback.durationMonths} ordered months. Daily study capacity must constrain workload. Strong skills need maintenance, not beginner treatment. Return JSON with one key, roadmap, whose items contain month, title, focus, topics, goals. Each topics/goals array needs 2-8 specific actionable strings.\nVERIFIED_FACTS\n${JSON.stringify(promptFacts)}`;
  try {
    const generate = options.generate || geminiService.generateRoadmapLanguage;
    const raw = await generate(prompt, { requestId: options.requestId });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const valid = normalizeRoadmap({ ...parsed, source: "gemini" }, fallback.durationMonths, fallback.targetRole);
    return valid || fallback;
  } catch (error) {
    console.warn("Roadmap generation failed; using deterministic fallback.", { requestId: options.requestId, message: error.message });
    return fallback;
  }
};

module.exports = { buildFallbackRoadmap, fingerprintRoadmapInput, generateRoadmap };
