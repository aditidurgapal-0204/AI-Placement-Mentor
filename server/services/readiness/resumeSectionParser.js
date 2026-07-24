const SECTION_PATTERNS = [
  {
    key: "education",
    regex: /(education|academic\s*background|academics?)/i,
  },
  {
    key: "skills",
    regex: /(skills?|technical\s*skills?|tech\s*stack)/i,
  },
  {
    key: "projects",
    regex: /(projects?|academic\s*projects?|personal\s*projects?)/i,
  },
  {
    key: "experience",
    regex: /(experience|work\s*experience|employment|internships?)/i,
  },
  {
    key: "leadership",
    regex: /(leadership|positions?\s*of\s*responsibility|extracurricular|extra[\s-]?curricular)/i,
  },
  {
    key: "certifications",
    regex: /(certifications?|licenses?|courses?)/i,
  },
  {
    key: "achievements",
    regex: /(achievements?|awards?|honours?|honors?)/i,
  },
];
function normalizeResumeText(text) {
    return text

        // remove multiple spaces
        .replace(/[ \t]+/g, " ")

        // normalize line endings
        .replace(/\r/g, "")

        // insert newline before ALL CAPS headings
        .replace(
            /(EDUCATION|SKILLS|PROJECTS|WORK EXPERIENCE|EXPERIENCE|INTERNSHIP|INTERNSHIPS|CERTIFICATIONS|ACHIEVEMENTS|LEADERSHIP|EXTRA[\s-]?CURRICULAR ACTIVITIES|POSITIONS OF RESPONSIBILITY)/gi,
            "\n$1\n"
        )

        // fix merged words
        .replace(/([a-z])([A-Z])/g, "$1 $2")

        // collapse blank lines
        .replace(/\n{2,}/g,"\n")

        .trim();
}