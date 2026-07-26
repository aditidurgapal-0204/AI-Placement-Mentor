/**
 * server/services/resume/sectionDetector.js
 *
 * PHASE 1
 * Detects major resume sections and returns their text.
 */

const SECTION_HEADERS = {
  education: [
    "education",
    "academic background",
    "academic qualification",
    "qualification"
  ],

  skills: [
    "skills",
    "technical skills",
    "technical expertise",
    "core skills",
    "technologies"
  ],

  projects: [
    "projects",
    "project",
    "academic projects",
    "personal projects",
    "selected projects",
    "technical projects",
    "project experience",
    "portfolio"
  ],

  experience: [
    "experience",
    "work experience",
    "professional experience",
    "internship",
    "internships"
  ],

  leadership: [
    "leadership",
    "positions of responsibility",
    "responsibility",
    "leadership experience"
  ],

  extracurricular: [
    "extra curricular",
    "extra curricular activities",
    "extracurricular",
    "extracurricular activities",
    "co curricular activities",
    "co-curricular activities",
    "activities",
    "volunteering"
  ],

  certifications: [
    "certifications",
    "certification",
    "courses",
    "training"
  ],

  achievements: [
    "achievements",
    "awards",
    "publications",
    "research"
  ]
};

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSections(resumeText) {

  const sections = {
    education: "",
    skills: "",
    projects: "",
    experience: "",
    leadership: "",
    extracurricular: "",
    certifications: "",
    achievements: "",
    other: ""
  };

  if (!resumeText) return sections;

  const lines = resumeText.split(/\r?\n/);

  let currentSection = "other";

  for (const rawLine of lines) {

    const line = normalize(rawLine);
    const compactLine = line.replace(/\s/g, "");

    let matchedSection = null;

    for (const [sectionName, headers] of Object.entries(SECTION_HEADERS)) {

      if (headers.some((header) => {
        const normalizedHeader = normalize(header);
        return normalizedHeader === line || normalizedHeader.replace(/\s/g, "") === compactLine;
      })) {
        matchedSection = sectionName;
        break;
      }

    }

    if (matchedSection) {
      currentSection = matchedSection;
      continue;
    }

    sections[currentSection] += rawLine + "\n";
  }
  return sections;
}

module.exports = {
  detectSections
};
