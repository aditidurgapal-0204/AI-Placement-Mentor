const { detectSections } = require("./resume/sectionDetector");
const { TECHNOLOGY_CATALOG } = require("./readiness/structuredProjectEvidence");
const geminiService = require("./geminiService");
const { CONTRACT_VERSION, CATEGORIES, validatePublicResumeAnalysis } = require("../contracts/publicResumeAnalysis.v1");

const ACTION_VERBS = ["built", "developed", "implemented", "designed", "created", "optimized", "improved", "reduced", "increased", "led", "managed", "delivered", "automated", "integrated", "deployed", "analyzed", "achieved"];
const SECTION_LABELS = [
  ["Contact Information", "contact"], ["Summary / Objective", "summary"], ["Education", "education"],
  ["Technical Skills", "skills"], ["Experience / Internship", "experience"], ["Projects", "projects"],
  ["Achievements", "achievements"], ["Certifications", "certifications"], ["Leadership / Extracurriculars", "leadership"]
];
const SUMMARY_HEADINGS = [
  "summary", "professional summary", "profile", "professional profile", "career summary",
  "objective", "career objective", "professional objective"
];
const CERTIFICATION_HEADINGS = [
  "certification", "certifications", "certificate", "certificates", "courses", "training",
  "certificates and courses", "courses and certifications", "professional certifications",
  "training and certifications"
];
const SECTION_BOUNDARY_HEADINGS = new Set([
  ...SUMMARY_HEADINGS, ...CERTIFICATION_HEADINGS,
  "education", "academic background", "academic qualification", "qualification",
  "skills", "technical skills", "technical expertise", "core skills", "technologies",
  "projects", "project", "academic projects", "personal projects",
  "experience", "work experience", "professional experience", "internship", "internships",
  "leadership", "positions of responsibility", "responsibility", "leadership experience",
  "extra curricular", "extra curricular activities", "extracurricular", "extracurricular activities",
  "co curricular activities", "achievements", "awards", "publications", "research"
]);

const clean = (value) => String(value || "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
const countMatches = (text, regex) => (text.match(regex) || []).length;
const present = (value) => Boolean(String(value || "").trim());
const clamp = (value) => Math.max(0, Math.min(20, Math.round(value)));
const unique = (values) => [...new Set(values.filter(Boolean))];

const normalizeHeading = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[&/]/g, " and ")
  .replace(/[\u2010-\u2015-]/g, " ")
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const matchHeadingLine = (rawLine, aliases, allowInlineContent = false) => {
  const normalizedAliases = new Set(aliases.map(normalizeHeading));
  const line = String(rawLine || "").trim();
  const wholeLine = normalizeHeading(line);
  const compactLine = wholeLine.replace(/\s/g, "");
  if (normalizedAliases.has(wholeLine)
    || [...normalizedAliases].some((alias) => alias.replace(/\s/g, "") === compactLine)) {
    return { matched: true, inlineContent: "" };
  }

  const separator = line.indexOf(":");
  if (separator >= 0 && normalizedAliases.has(normalizeHeading(line.slice(0, separator)))) {
    return { matched: true, inlineContent: line.slice(separator + 1).trim() };
  }

  if (allowInlineContent) {
    const orderedAliases = [...normalizedAliases].sort((a, b) => b.length - a.length);
    for (const alias of orderedAliases) {
      const flexibleAlias = alias.split(" ").map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
      const inlineMatch = line.match(new RegExp(`^[^a-z0-9]*${flexibleAlias}(?:\\s+|\\s*[|\u2013\u2014-]\\s*)(.+)$`, "i"));
      if (inlineMatch?.[1]?.trim()) return { matched: true, inlineContent: inlineMatch[1].trim() };
    }
  }

  return { matched: false, inlineContent: "" };
};

const extractAliasedSection = (resumeText, aliases) => {
  const lines = String(resumeText || "").split(/\r?\n/);
  const firstEstablishedSection = lines.findIndex((line) => {
    const normalized = normalizeHeading(line);
    return SECTION_BOUNDARY_HEADINGS.has(normalized) && !SUMMARY_HEADINGS.includes(normalized);
  });
  for (let index = 0; index < lines.length; index += 1) {
    const heading = matchHeadingLine(lines[index], aliases, firstEstablishedSection < 0 || index < firstEstablishedSection);
    if (!heading.matched) continue;

    const contentLines = heading.inlineContent ? [heading.inlineContent] : [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (SECTION_BOUNDARY_HEADINGS.has(normalizeHeading(lines[cursor]))) break;
      contentLines.push(lines[cursor]);
    }
    return { heading: lines[index].trim(), content: clean(contentLines.join("\n")) };
  }
  return { heading: "", content: "" };
};

const cleanEvidenceEntry = (value) => String(value || "")
  .replace(/^[\s\u2022*-]+/, "")
  .replace(/\s+/g, " ")
  .trim();

const isCredibleCertificationEntry = (rawLine) => {
  const entry = cleanEvidenceEntry(rawLine);
  const words = entry.split(/\s+/).filter(Boolean);
  if (!entry || entry.length > 150 || words.length > 18) return false;
  if (/\b(?:seeking|interested in|planning to|plan to|would like to)\b/i.test(entry)) return false;

  const providerPrefix = /^(?:aws|amazon web services|google|microsoft|ibm|oracle|cisco|meta|nptel|coursera|udemy|edx|linkedin learning|infosys springboard)\b/i;
  const courseTitleSignal = /\b(?:programming|fundamentals|specialization|professional program|cloud practitioner|data analytics|data science|machine learning|artificial intelligence|cybersecurity|internet of things|web development|software development)\b/i;
  const explicitCredential = /\b(?:certified|certification|certificate|credential|nanodegree)\b/i.test(entry);
  const narrativeSignal = /\b(?:i|we|my|our|project|application|feature|system|team members?|implemented|built|developed|learned|worked)\b/i.test(entry);
  if (explicitCredential && !narrativeSignal
    && (providerPrefix.test(entry) || /^(?:certified|certification|certificate|credential|nanodegree)\b/i.test(entry))) return true;

  if (providerPrefix.test(entry) && courseTitleSignal.test(entry)) return true;

  const parts = entry.split(/\s+(?:-|\u2013|\u2014|\|)\s+|\s*:\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2 || !courseTitleSignal.test(parts[1])) return false;

  const provider = parts[0];
  const providerWords = provider.split(/\s+/).filter(Boolean);
  const genericProviderSignal = /\b(?:academy|university|institute|learning|school|training|education|foundation|springboard)\b/i.test(provider);
  const providerLooksStructured = providerWords.length <= 6
    && !/\b(?:built|created|developed|implemented|completed|learned|trained|project|team)\b/i.test(provider)
    && (genericProviderSignal || /^[A-Z0-9]{2,12}$/.test(provider));
  return providerLooksStructured;
};

const detectCertificationEvidence = (resumeText, sections) => {
  const aliasedSection = extractAliasedSection(resumeText, CERTIFICATION_HEADINGS);
  const dedicatedText = present(sections.certifications) ? sections.certifications : aliasedSection.content;
  const dedicatedEntries = unique(String(dedicatedText || "").split(/\r?\n/).map(cleanEvidenceEntry).filter(Boolean));
  if (dedicatedEntries.length) return { present: true, dedicated: true, entries: dedicatedEntries };

  const excludedLines = new Set([sections.projects, sections.experience]
    .flatMap((section) => String(section || "").split(/\r?\n/))
    .map(cleanEvidenceEntry)
    .filter(Boolean));
  const entries = unique(String(resumeText || "").split(/\r?\n/)
    .map(cleanEvidenceEntry)
    .filter((line) => line && !excludedLines.has(line) && !SECTION_BOUNDARY_HEADINGS.has(normalizeHeading(line)))
    .filter(isCredibleCertificationEntry));
  return { present: entries.length > 0, dedicated: false, entries };
};

const labelForScore = (score) => score >= 90 ? "Excellent" : score >= 75 ? "Strong" : score >= 60 ? "Good Foundation" : score >= 40 ? "Needs Improvement" : "Needs Major Improvement";

const analyzeEvidence = (input) => {
  const resumeText = clean(input);
  const sections = detectSections(resumeText);
  const lower = resumeText.toLowerCase();
  const lines = resumeText.split("\n").map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => /^[•*\-]/.test(line) || ACTION_VERBS.some((verb) => new RegExp(`^${verb}\\b`, "i").test(line)));
  const actionBullets = bulletLines.filter((line) => ACTION_VERBS.some((verb) => new RegExp(`(?:^|[^a-z])${verb}(?:ed|ing|s)?\\b`, "i").test(line)));
  const quantifiedLines = lines.filter((line) => /\b\d+(?:\.\d+)?\s*(?:%|x|users?|records?|requests?|ms|seconds?|minutes?|hours?|projects?|members?|rank|st|nd|rd|th)\b/i.test(line));
  const contact = {
    email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(resumeText),
    phone: /(?:\+?\d[\d\s()-]{8,}\d)/.test(resumeText),
    link: /(?:https?:\/\/|www\.|linkedin\.com|github\.com)/i.test(resumeText)
  };
  const summarySection = extractAliasedSection(resumeText, SUMMARY_HEADINGS);
  const summaryPresent = present(summarySection.content);
  const certificationEvidence = detectCertificationEvidence(resumeText, sections);
  const detectedTechnologies = TECHNOLOGY_CATALOG.filter((technology) => new RegExp(`(?:^|[^a-z0-9])${technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(resumeText));
  const projectLines = String(sections.projects || "").split("\n").filter((line) => line.trim());
  const hasProjects = present(sections.projects);
  const hasExperience = present(sections.experience);
  const hasAlternativeEvidence = present(sections.leadership) || present(sections.extracurricular) || present(sections.achievements) || certificationEvidence.present;
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;

  const structure = clamp(
    (present(sections.education) ? 4 : 0) + (present(sections.skills) ? 4 : 0) +
    (hasProjects || hasExperience ? 4 : 0) + (lines.length >= 8 ? 3 : 1) +
    (wordCount >= 180 && wordCount <= 900 ? 3 : wordCount >= 100 ? 2 : 0) +
    (countMatches(resumeText, /\|/g) < 30 ? 2 : 0)
  );
  const content = clamp(
    (contact.email ? 3 : 0) + (contact.phone ? 2 : 0) + (contact.link ? 2 : 0) +
    (present(sections.education) ? 5 : 0) + (summaryPresent ? 3 : 0) +
    (actionBullets.length >= 4 ? 5 : actionBullets.length >= 2 ? 3 : actionBullets.length ? 1 : 0)
  );
  const skills = clamp(
    (present(sections.skills) ? 8 : 0) + Math.min(8, detectedTechnologies.length * 2) +
    (present(sections.skills) && detectedTechnologies.length >= 3 ? 4 : detectedTechnologies.length ? 2 : 0)
  );
  const projectsExperience = clamp(
    (hasProjects ? 8 : 0) + (projectLines.length >= 4 ? 4 : projectLines.length >= 2 ? 2 : 0) +
    (hasExperience ? 5 : hasAlternativeEvidence ? 5 : hasProjects ? 3 : 0) +
    (hasProjects && actionBullets.length >= 2 ? 3 : actionBullets.length ? 1 : 0)
  );
  const impact = clamp(
    (actionBullets.length >= 5 ? 6 : actionBullets.length >= 2 ? 4 : actionBullets.length ? 2 : 0) +
    (quantifiedLines.length >= 3 ? 7 : quantifiedLines.length === 2 ? 5 : quantifiedLines.length ? 3 : 0) +
    (present(sections.achievements) ? 3 : 0) + (certificationEvidence.present ? 2 : 0) +
    (/github\.com/i.test(resumeText) ? 2 : 0)
  );

  return { resumeText, sections, contact, summaryPresent, summaryText: summarySection.content, certificationEvidence, detectedTechnologies, wordCount, bulletCount: bulletLines.length,
    actionBulletCount: actionBullets.length, quantifiedLineCount: quantifiedLines.length, hasProjects, hasExperience,
    hasAlternativeEvidence, scores: { content, structure, skills, projectsExperience, impact } };
};

const sectionItem = (section, exists, strongFeedback, missingFeedback, strong = false) => ({
  section,
  status: exists ? (strong ? "Strong" : "Present") : "Missing",
  feedback: exists ? strongFeedback : missingFeedback
});

const buildDeterministicAnalysis = (resumeText) => {
  const evidence = analyzeEvidence(resumeText);
  const { sections, contact, scores } = evidence;
  const breakdownScores = [scores.content, scores.structure, scores.skills, scores.projectsExperience, scores.impact];
  const atsScore = breakdownScores.reduce((sum, score) => sum + score, 0);
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];
  const summaryWordCount = evidence.summaryText.split(/\s+/).filter(Boolean).length;
  const summaryFeedback = summaryWordCount > 80
    ? "A summary or objective is present and gives early context; shorten it to keep the strongest, evidence-based details prominent."
    : summaryWordCount > 0 && summaryWordCount < 12
      ? "A summary or objective is present; make it more specific about current strengths and goals while keeping every claim supportable."
      : "A summary or objective is present and gives early context; keep it concise, specific, and supported by the rest of the resume.";
  const certificationFeedback = evidence.certificationEvidence.dedicated
    ? "Certifications or training are visible in a dedicated section; prioritize relevant and credible items."
    : `Certification or training evidence is present${evidence.certificationEvidence.entries.length ? `, including ${evidence.certificationEvidence.entries.slice(0, 2).join(" and ")}` : ""}. Consider placing it under a dedicated Certifications section for better ATS visibility.`;

  if (present(sections.education)) strengths.push("Education is clearly separated and easy for an ATS to identify.");
  if (present(sections.skills) && evidence.detectedTechnologies.length >= 3) strengths.push(`Technical skills are visible, including ${evidence.detectedTechnologies.slice(0, 4).join(", ")}.`);
  if (evidence.hasProjects) strengths.push("Projects provide relevant student evidence beyond academic qualifications.");
  if (evidence.hasExperience) strengths.push("Experience or internship information is presented in a dedicated section.");
  if (!evidence.hasExperience && evidence.hasProjects) strengths.push("Project evidence gives the resume meaningful fresher-level practical credibility.");
  if (evidence.quantifiedLineCount >= 2) strengths.push("Multiple resume statements include measurable outcomes or scale.");
  if (contact.email && contact.phone) strengths.push("Core contact information is detectable near the resume content.");

  if (!contact.email || !contact.phone) weaknesses.push("Core contact information is incomplete or difficult for an ATS to detect.");
  if (!present(sections.skills)) weaknesses.push("A clearly named technical skills section is missing.");
  if (!evidence.hasProjects && !evidence.hasExperience) weaknesses.push("The resume lacks a dedicated projects or experience section showing applied work.");
  if (evidence.actionBulletCount < 2) weaknesses.push("Too few bullet points begin with clear action-oriented language.");
  if (evidence.quantifiedLineCount === 0) weaknesses.push("Project, achievement, and experience statements contain no detectable measurable outcomes.");
  if (!evidence.summaryPresent) weaknesses.push("No concise summary or objective is detected; this is optional but can improve context for a student resume.");
  if (evidence.wordCount < 120) weaknesses.push("The extracted resume content is unusually brief and may not show enough evidence.");

  if (!present(sections.skills)) recommendations.push("Add a clearly titled Technical Skills section and list only technologies you can confidently discuss.");
  if (evidence.actionBulletCount < 3) recommendations.push("Rewrite key bullets using action + implementation + outcome, while keeping every claim factually supportable.");
  if (evidence.quantifiedLineCount < 2) recommendations.push("Where genuine evidence exists, add scale or outcomes such as users, features, records, response time, ranking, or percentage change.");
  if (evidence.hasProjects) recommendations.push("For each important project, state what you built, how you implemented it, and what result or working outcome you achieved.");
  if (!evidence.hasProjects) recommendations.push("Add a Projects section containing the strongest academic or personal work relevant to the opportunities you pursue.");
  if (!contact.link) recommendations.push("Add a working LinkedIn, GitHub, or portfolio link if it contains material you are comfortable sharing with recruiters.");
  if (!evidence.summaryPresent) recommendations.push("Consider a two-line student summary focused on current strengths and the type of opportunity sought, without unsupported claims.");

  if (!strengths.length) strengths.push("The PDF contains readable text that can be evaluated by an ATS.");
  if (!weaknesses.length) weaknesses.push("The resume is structurally strong; the next gain is making the best evidence more concise and outcome-focused.");
  if (!recommendations.length) recommendations.push("Tailor the ordering of skills and evidence for each application while keeping all claims accurate.");

  const sectionFeedback = [
    sectionItem("Contact Information", contact.email || contact.phone, "Contact details are detectable; verify every link before applying.", "Add a professional email address and reliable phone number at the top of the resume.", contact.email && contact.phone),
    sectionItem("Summary / Objective", evidence.summaryPresent, summaryFeedback, "Optional for freshers: add a concise summary only if it contributes specific, useful context."),
    sectionItem("Education", present(sections.education), "Education is presented in a recognizable section.", "Add a clearly named Education section with degree, institution, and dates.", present(sections.education)),
    sectionItem("Technical Skills", present(sections.skills), evidence.detectedTechnologies.length ? `Detected technical terms include ${evidence.detectedTechnologies.slice(0, 6).join(", ")}.` : "The section is present, but make skill names explicit and consistently formatted.", "Add a Technical Skills section with accurate languages, frameworks, tools, and databases.", evidence.detectedTechnologies.length >= 4),
    sectionItem("Experience / Internship", evidence.hasExperience, "Experience or internship content is clearly separated and reviewable.", "No experience section was detected. This is acceptable for a fresher when strong projects and other evidence are present."),
    sectionItem("Projects", evidence.hasProjects, "Projects are visible; strengthen each description with ownership, implementation, and supported outcomes.", "Add a Projects section to demonstrate applied technical ability.", evidence.hasProjects && evidence.actionBulletCount >= 3),
    sectionItem("Achievements", present(sections.achievements), "Achievements are separated from other content and can be reviewed quickly.", "Add an Achievements section only when you have relevant, verifiable accomplishments."),
    sectionItem("Certifications", evidence.certificationEvidence.present, certificationFeedback, "Certifications are optional; projects and demonstrated skills can provide equivalent student evidence."),
    sectionItem("Leadership / Extracurriculars", present(sections.leadership) || present(sections.extracurricular), "Leadership or extracurricular evidence adds useful student context.", "Add this section only if you have relevant, verifiable responsibility or participation.")
  ];

  const analysis = {
    contractVersion: CONTRACT_VERSION, atsScore, scoreLabel: labelForScore(atsScore),
    summary: `This resume scores ${atsScore}/100 using deterministic ATS checks. ${atsScore >= 75 ? "Its structure and visible evidence form a strong base." : atsScore >= 60 ? "It has a useful foundation with several targeted improvements available." : "It needs clearer structure and stronger evidence presentation."}`,
    scoreBreakdown: CATEGORIES.map((category, index) => ({ category, score: breakdownScores[index], maxScore: 20 })),
    strengths: unique(strengths).slice(0, 6), weaknesses: unique(weaknesses).slice(0, 6),
    sectionFeedback, recommendations: unique(recommendations).slice(0, 7),
    evidence: { wordCount: evidence.wordCount, detectedTechnologyCount: evidence.detectedTechnologies.length, actionBulletCount: evidence.actionBulletCount, quantifiedLineCount: evidence.quantifiedLineCount }
  };
  const validation = validatePublicResumeAnalysis(analysis);
  if (!validation.valid) throw new Error(`Deterministic resume analysis invalid: ${validation.errors.join("; ")}`);
  return { analysis, groundingFacts: { scoreLabel: analysis.scoreLabel, strongestCategories: analysis.scoreBreakdown.filter((item) => item.score >= 14).map((item) => item.category), weakestCategories: analysis.scoreBreakdown.filter((item) => item.score < 10).map((item) => item.category), strengths: analysis.strengths, weaknesses: analysis.weaknesses } };
};

const validateAiSummary = (value, groundingFacts) => {
  if (!value || typeof value !== "object" || typeof value.summary !== "string") return null;
  const summary = value.summary.replace(/\s+/g, " ").trim();
  const words = summary.split(/\s+/).filter(Boolean).length;
  if (words < 20 || words > 80 || /\b\d+(?:\.\d+)?%?\b/.test(summary)) return null;
  const factText = JSON.stringify(groundingFacts).toLowerCase();
  const inventedTechnology = TECHNOLOGY_CATALOG.some((technology) =>
    new RegExp(`(?:^|[^a-z0-9])${technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(summary)
    && !factText.includes(technology.toLowerCase())
  );
  if (inventedTechnology) return null;
  const factTokens = new Set(factText.match(/[a-z]{4,}/g) || []);
  const stop = new Set(["this", "that", "with", "from", "your", "resume", "student", "have", "into", "only"]);
  const sentences = summary.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const grounded = sentences.every((sentence) => unique((sentence.toLowerCase().match(/[a-z]{4,}/g) || []).filter((token) => !stop.has(token) && factTokens.has(token))).length >= 2);
  return grounded ? summary : null;
};

const analyzePublicResume = async (resumeText, options = {}) => {
  const { analysis, groundingFacts } = buildDeterministicAnalysis(resumeText);
  try {
    const generate = options.generateSummary || geminiService.generatePublicResumeSummary;
    const raw = await generate(`Write a 2-3 sentence student-resume diagnostic summary using only these backend-verified facts. Do not add technologies, employers, achievements, metrics, scores, or missing skills. Return JSON with only summary.\nVERIFIED_FACTS\n${JSON.stringify(groundingFacts)}`, { requestId: options.requestId });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const summary = validateAiSummary(parsed, groundingFacts);
    if (summary) analysis.summary = summary;
  } catch (error) {
    console.warn("Public resume summary unavailable; using deterministic summary.", { requestId: options.requestId, message: error.message });
  }
  return analysis;
};

module.exports = { analyzeEvidence, buildDeterministicAnalysis, analyzePublicResume, labelForScore };
