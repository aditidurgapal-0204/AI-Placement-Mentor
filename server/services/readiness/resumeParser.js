/**
 * server/services/readiness/resumeParser.js
 * STRUCTURED PRODUCTION RESUME FACT SCANNER
 */
const { detectSections } = require("../resume/sectionDetector");

const parseOrganization = (textLine) => {
  const atOrHandleMatch = textLine.match(/(?:\bat\b|@)\s+([A-Z][a-zA-Z0-9&.,\s]{1,50})/i);
  if (atOrHandleMatch) return atOrHandleMatch[1].trim();

  // Common resume form: "Technical Team Coordinator – Enginium".
  const separatorMatch = textLine.match(/\s(?:-|\u2013|\u2014|\|)\s*([A-Z][a-zA-Z0-9&.\s]{1,50})/);
  if (separatorMatch) return separatorMatch[1].trim();

  // Also supports entries such as "Technical Team Coordinator (Enginium)".
  const parentheticalMatch = textLine.match(/\(([A-Z][a-zA-Z0-9&.,\s]{1,50})\)\s*$/);
  return parentheticalMatch ? parentheticalMatch[1].trim() : null;
};

const isActualInternshipTitle = (line) => {
  const normalized = line.toLowerCase().replace(/[-\u2013\u2014]/g, " ").replace(/\s+/g, " ");
  const internshipTitle = /\b(?:software engineer|software developer|web developer|frontend developer|front end developer|backend developer|back end developer|full stack developer|data science|data analyst|machine learning|research|devops|qa|quality assurance|sde|engineering)\s+intern\b|\bintern\s+(?:software|web|frontend|front end|backend|back end|full stack|data science|data analyst|machine learning|research|devops|qa|quality assurance|sde|engineering)\b/;
  return internshipTitle.test(normalized);
};

const extractCertificationEntries = (certificationSection) => {
  const lines = String(certificationSection || "").split(/\r?\n/);
  const hasBullets = lines.some((line) => /^\s*[-*\u2022]\s+\S/.test(line));
  const entries = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^[-*\u2022]\s+(.+)$/);
    if (bulletMatch) {
      entries.push(bulletMatch[1].trim());
    } else if (hasBullets && entries.length > 0) {
      entries[entries.length - 1] += ` ${line}`;
    } else {
      entries.push(line);
    }
  }

  return [...new Map(entries.map((entry) => [
    entry.toLowerCase().replace(/\s+/g, " ").trim(),
    entry
  ])).values()];
};

const cleanEvidenceLine = (line) => String(line || "").replace(/^[\s•*-]+/, "").replace(/\s+/g, " ").trim().slice(0, 160);
const uniqueEvidence = (items) => [...new Map(items.map((item) => [cleanEvidenceLine(item).toLowerCase(), cleanEvidenceLine(item)]))
  .values()].filter(Boolean);

const extractSupplementalResumeEvidence = (sections) => {
  const supplemental = [sections.extracurricular, sections.achievements, sections.other, sections.certifications]
    .filter(Boolean).join("\n").split(/\r?\n/).map(cleanEvidenceLine).filter(Boolean);
  const select = (patterns) => uniqueEvidence(supplemental.filter((line) => patterns.some((pattern) => pattern.test(line))));
  const certified = select([
    /\b(?:certificate|certified|certification|successfully completed|completion certificate)\b/i,
    /\b(?:nptel|coursera|udemy|edx|infosys springboard)\b.{0,100}\b(?:completed|certificate|certified|course)\b/i,
    /\b(?:completed|certificate|certified)\b.{0,100}\b(?:programming|python|java|c\+\+|web development|data science|machine learning)\b/i
  ]).filter((line) => !/\b(?:seeking|interested in|plan(?:ning)? to|pursuing)\b/i.test(line));
  return {
    publicSpeaking: select([/\bpublic speaking\b/i, /\b(?:anchored|anchoring|event anchor|master of ceremonies|emcee)\b/i]),
    societyParticipation: select([/\b(?:member|coordinator|president|secretary|head|lead)\b.{0,100}\b(?:society|club|association|committee|chapter)\b/i, /\b(?:society|club|association|committee|chapter)\b.{0,100}\b(?:member|coordinator|president|secretary|head|lead)\b/i]),
    volunteering: select([/\b(?:volunteer|volunteered|community service|ngo|social service)\b/i]),
    certifications: uniqueEvidence([...extractCertificationEntries(sections.certifications), ...certified]),
    measurableAchievements: select([/\b(?:won|winner|ranked|secured|awarded|achieved|improved|reduced|increased)\b.{0,80}\b\d+(?:\.\d+)?(?:%|x|st|nd|rd|th)?\b/i])
  };
};

const hasOpenSourceEvidence = (resumeText) => {
  const normalized = resumeText.toLowerCase().replace(/\s+/g, " ");
  return [
    /\b(?:contribut(?:ed|ing|or)|maintain(?:ed|ing|er))\b.{0,80}\bopen[- ]source\b/,
    /\bopen[- ]source\b.{0,80}\b(?:contribut(?:ed|ing|or)|maintain(?:ed|ing|er))\b/,
    /\b(?:google summer of code|gsoc)\b/,
    /\b(?:merged|submitted|authored)\s+(?:\d+\s+)?(?:pull requests?|prs?)\b/,
    /\b(?:issue|code) contributions?\b.{0,80}\b(?:public|open[- ]source)\s+repositor(?:y|ies)\b/,
    /\bcontribut(?:ed|ing|or)\b.{0,80}\bpublic\s+repositor(?:y|ies)\b/
  ].some((pattern) => pattern.test(normalized));
};

const detectResearchEvidence = (resumeText) => {
  const normalized = resumeText.toLowerCase().replace(/\s+/g, " ");
  const hasAcademicEvidence = [
    /\bresearch paper\b/,
    /\bjournal paper\b/,
    /\bconference paper\b/,
    /\bpeer[- ]reviewed (?:paper|article|publication)\b/,
    /\bpublished in\b.{0,100}\b(?:academic |international )?(?:journal|conference)\b/,
    /\bpresented (?:a |the )?paper\b.{0,80}\bacademic conference\b/,
    /\bacademic publication\b.{0,100}\b(?:journal|conference|venue)\b/,
    /\b(?:ieee|springer|acm|doi)\b/
  ].some((pattern) => pattern.test(normalized));

  if (!hasAcademicEvidence) return { exists: false, publicationType: null };
  if (/\bieee\b/.test(normalized)) return { exists: true, publicationType: "IEEE" };
  if (/\bspringer\b/.test(normalized)) return { exists: true, publicationType: "Springer" };
  if (/\bacm\b/.test(normalized)) return { exists: true, publicationType: "ACM" };
  if (/\bconference(?: paper)?\b|\bacademic conference\b/.test(normalized)) {
    return { exists: true, publicationType: "Conference" };
  }
  if (/\binternational journal\b|\bjournal paper\b|\bpublished in\b.{0,100}\bjournal\b/.test(normalized)) {
    return { exists: true, publicationType: "International Journal" };
  }
  return { exists: true, publicationType: "Academic Publication" };
};

// ISSUE 3: One structural fact instance pass execution handling
const extractResumeMetrics = (resumeText, canonicalProjectFacts) => {
  const result = {
    internship: { exists: false, organization: null, duration: null, relevance: "Unknown" },
    leadership: { exists: false, role: null, organization: null },
    research: { exists: false, publicationType: null },
    certifications: { exists: false, count: 0 },
    competitiveProgramming: { exists: false, platformDetected: null },
    hackathons: { exists: false, context: null },
    openSource: { exists: false },
    projects: canonicalProjectFacts, // Ingesting the unique truth configuration directly
    hasGitHub: false,
    detectedTechnologies: [],
    resumeEvaluated: false,
    activities: { publicSpeaking: [], societyParticipation: [], volunteering: [], measurableAchievements: [] },
    certificationEntries: []
  };

  if (!resumeText || typeof resumeText !== "string" || resumeText.trim() === "") {
    return result;
  }

  const text = resumeText.toLowerCase();
  result.resumeEvaluated = true;

  const lines = resumeText.split(/\r?\n/);
  const sections = detectSections(resumeText);
  const supplementalEvidence = extractSupplementalResumeEvidence(sections);
  const certificationEntries = supplementalEvidence.certifications;
  result.certifications.exists = certificationEntries.length > 0;
  result.certifications.count = certificationEntries.length;
  result.certificationEntries = certificationEntries;
  result.activities = {
    publicSpeaking: supplementalEvidence.publicSpeaking,
    societyParticipation: supplementalEvidence.societyParticipation,
    volunteering: supplementalEvidence.volunteering,
    measurableAchievements: supplementalEvidence.measurableAchievements
  };
  const leadershipLines = `${sections.leadership}\n${sections.extracurricular}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  result.hasGitHub =
  /github/i.test(resumeText) ||
  /gitlab/i.test(resumeText);
  result.openSource.exists = hasOpenSourceEvidence(resumeText);
  result.research = detectResearchEvidence(resumeText);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    if (!result.internship.exists) {

    if (isActualInternshipTitle(line)) {

        result.internship.exists = true;

        result.internship.organization = parseOrganization(line);

        const durationMatch =
            line.match(/\d+\s*(month|months|week|weeks)/i);

        result.internship.duration =
            durationMatch ? durationMatch[0] : null;

        result.internship.relevance =
            [
                "software",
                "engineering",
                "developer",
                "backend",
                "frontend",
                "machine learning",
                "data"
            ].some(k => lowerLine.includes(k))
            ? "High"
            : "Medium";
    }
}

  // Leadership evidence is intentionally read only from leadership-related sections.
  // This prevents project prose from being mistaken for a position of responsibility.
  if (!result.leadership.exists && leadershipLines.includes(line)) {
  const compactLowerLine = lowerLine.replace(/\s/g, "");

  const leadershipKeywords = [
    "technical team coordinator",
    "coordinator",
    "team coordinator",
    "lead",
    "leader",
    "captain",
    "president",
    "head",
    "chair",
    "chairperson",
    "secretary",
    "organizer",
    "mentor",
    "founder",
    "co-founder",
    "vice president",
    "committee",
    "event anchor"
  ];

  if (leadershipKeywords.some(k => compactLowerLine.includes(k.replace(/\s/g, "")))) {

    result.leadership.exists = true;

    const roleMatch = line.match(
      /(Technical Team Coordinator|Team Coordinator|Vice President|Co-Founder|Event Anchor|Coordinator|President|Captain|Head|Lead|Leader|Founder|Secretary|Organizer|Mentor|Chair)/i
    );

    result.leadership.role = compactLowerLine.includes("technicalteamcoordinator")
      ? "Technical Team Coordinator"
      : roleMatch
        ? roleMatch[0]
        : line;

    result.leadership.organization = parseOrganization(line);
  }
}
    if (!result.competitiveProgramming.exists && ["codeforces", "codechef", "leetcode", "hackerrank", "topcoder"].some(k => lowerLine.includes(k))) {
      result.competitiveProgramming.exists = true;
      const platMatch = line.match(/(Codeforces|CodeChef|LeetCode|HackerRank)/i);
      result.competitiveProgramming.platformDetected = platMatch ? platMatch[0] : "Generic Platform";
    }

    if (!result.hackathons.exists && ["hackathon", "smart india hackathon", "sih", "devpost"].some(k => lowerLine.includes(k))) {
      result.hackathons.exists = true;
      result.hackathons.context = lowerLine.includes("sih") || lowerLine.includes("smart india") ? "National Level SIH" : "Ecosystem Hackathon";
    }

  }

  const techStack = ["react", "node.js", "express", "next.js", "python", "java", "c++", "postgresql", "mongodb", "typescript"];
  techStack.forEach(tech => {
    if (text.includes(tech)) result.detectedTechnologies.push(tech);
  });

  return result;
};

module.exports = { extractResumeMetrics };
