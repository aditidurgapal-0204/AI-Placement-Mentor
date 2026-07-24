const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const { detectSections } = require("../resume/sectionDetector");
const contains = (text, phrase) => new RegExp(`(?:^|[^a-z0-9])${escapeRegex(phrase)}(?:$|[^a-z0-9])`, "i").test(text);

const CAPABILITY_SIGNALS = {
  recommendationSystem: ["recommendation system", "recommendation engine", "content-based filtering", "collaborative filtering"],
  dataPreprocessing: ["data preprocessing", "preprocessing", "data cleaning", "data normalization", "feature scaling"],
  featureEngineering: ["feature engineering", "feature extraction", "feature selection"],
  databaseIntegration: ["database", "sql", "postgresql", "mysql", "mongodb", "sqlite", "firebase", "supabase"],
  systemDesign: ["system design", "service architecture", "modular architecture", "modular application", "design pattern"],
  automation: ["automation", "automated", "workflow", "scripting"],
  visualization: ["visualization", "dashboard", "chart", "map", "mapping", "openstreetmap", "tableau", "power bi"],
  accessibility: ["accessibility", "accessible", "wcag", "aria"],
  dataAnalysis: ["data analysis", "analytics", "statistics", "statistical", "insights"],
  modelEvaluation: ["model evaluation", "accuracy", "precision", "recall", "f1 score", "cross validation"],
  apiIntegration: ["api integration", "integrated api", "rest api", "graphql", "third-party api"]
};

const METHOD_SIGNALS = [
  "content-based filtering", "collaborative filtering", "cosine similarity", "feature engineering",
  "feature extraction", "feature selection", "data preprocessing", "data cleaning", "data normalization",
  "cross validation", "model evaluation", "responsive design", "state management", "route visualization",
  "modular architecture", "role based access control", "authentication", "caching", "indexing"
];

const TECHNOLOGY_CATALOG = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "R", "Kotlin", "Swift",
  "React", "Vue", "Angular", "Next.js", "Node.js", "Express", "Flask", "Django", "FastAPI", "Spring Boot",
  "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis", "Firebase", "Supabase", "AWS", "Azure", "GCP",
  "Docker", "Kubernetes", "Vercel", "Render", "Netlify", "Git", "GitHub", "TensorFlow", "PyTorch",
  "scikit-learn", "Pandas", "NumPy", "Tableau", "Power BI", "Flutter", "React Native"
];

const sanitizeProjectName = (value) => String(value || "")
  .replace(/https?:\/\/\S+|www\.\S+|\b(?:github|gitlab)\.com\/\S+/gi, " ")
  .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\s*[-–—]\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}|present)\b/gi, " ")
  .replace(/\b20\d{2}\s*[-–—]\s*(?:20\d{2}|present)\b/gi, " ")
  .replace(/[|•]+/g, " ")
  .replace(/[()\[\]]/g, " ")
  .replace(/\s*[-–—]\s*$/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 100);

const ROLE_WEIGHTS = {
  "ML Engineer": { machineLearning: 5, recommendationSystem: 5, dataPreprocessing: 4, featureEngineering: 4, modelEvaluation: 4, dataEngineering: 3, backend: 2, deployment: 2 },
  "Data Analyst": { dataAnalysis: 5, visualization: 5, databaseIntegration: 4, dataPreprocessing: 4, dataEngineering: 3, machineLearning: 2 },
  "Frontend Developer": { frontend: 5, accessibility: 4, visualization: 3, apiIntegration: 3, deployment: 2 },
  "Backend Developer": { backend: 5, databaseIntegration: 5, apiIntegration: 4, authentication: 4, scalability: 4, systemDesign: 4, deployment: 2 },
  "Software Development Engineer": { frontend: 3, backend: 3, databaseIntegration: 3, authentication: 3, deployment: 2, systemDesign: 4, scalability: 4, mobile: 3, cybersecurity: 3 }
};

const extractExplicitTechnologyTokens = (projectText) => {
  const matches = [...projectText.matchAll(/(?:tech\s*stack|tech(?:nologies|nology)?(?:\s+used)?|built\s+with|using)\s*[:\-]?\s*([^\n.]+)/gi)];
  return matches.flatMap((match) => match[1].split(/,|\+|\||\band\b/gi))
    .map((value) => value.replace(/^[\s:–—-]+|[()]+$/g, "").trim())
    .filter((value) => value.length >= 2 && value.length <= 40 && !/^(a|an|the|secure|responsive|application|website)$/i.test(value));
};

const extractTechnologies = (projectText) => {
  const detected = TECHNOLOGY_CATALOG.filter((technology) => contains(projectText, technology));
  const contextual = [...projectText.matchAll(/(?:integrated?|with|using)\s+([A-Z][A-Za-z0-9.+#-]{1,30})(?:\s+(?:integration|API|SDK))?/g)]
    .map((match) => match[1]);
  return [...new Set([...detected, ...extractExplicitTechnologyTokens(projectText), ...contextual])];
};

const extractOutcomes = (projectText) => projectText.split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /\b\d+(?:\.\d+)?\s*(?:%|x|users?|records?|requests?|ms|seconds?|minutes?|hours?)\b|improv(?:ed|ement)|reduc(?:ed|tion)|increas(?:ed|e)/i.test(line))
  .map((line) => line.replace(/^[•*\-\s]+/, ""));

const enrichProjectEvidence = (projectText, baseProject, canonicalRole) => {
  const technologies = extractTechnologies(projectText);
  const methods = METHOD_SIGNALS.filter((method) => contains(projectText, method));
  const capabilities = { ...baseProject.capabilities };
  Object.entries(CAPABILITY_SIGNALS).forEach(([category, signals]) => {
    capabilities[category] = signals.some((signal) => contains(projectText, signal));
  });

  const evidence = [];
  Object.entries(capabilities).forEach(([category, exists]) => {
    if (!exists) return;
    const signals = CAPABILITY_SIGNALS[category] || [];
    const matched = signals.filter((signal) => contains(projectText, signal));
    evidence.push({ category, facts: matched.length ? matched : [category] });
  });

  if (technologies.length) evidence.push({ category: "technologies", facts: technologies });

  const complexityIndicators = [
    ...methods,
    ...(capabilities.distributedSystems ? ["distributed systems"] : []),
    ...(capabilities.scalability ? ["scalability"] : []),
    ...(capabilities.deployment ? ["deployment"] : []),
    ...(capabilities.systemDesign ? ["system design"] : [])
  ];
  const weights = ROLE_WEIGHTS[canonicalRole] || ROLE_WEIGHTS["Software Development Engineer"];
  const roleRelevance = Object.entries(capabilities).reduce(
    (score, [category, exists]) => score + (exists ? (weights[category] || 0) : 0), 0
  );

  return {
    ...baseProject,
    name: sanitizeProjectName(baseProject.name),
    description: projectText.split(/\r?\n/).slice(1).join(" ").replace(/^[•*\-\s]+/, "").trim(),
    technologies,
    unknownTechnologies: technologies.filter((technology) => !TECHNOLOGY_CATALOG.includes(technology)),
    capabilities,
    methods,
    evidence,
    complexityIndicators: [...new Set(complexityIndicators)],
    outcomeIndicators: extractOutcomes(projectText),
    roleRelevance
  };
};

const extractLeadershipItems = (resumeText) => {
  const sections = detectSections(resumeText || "");
  const content = [sections.leadership, sections.extracurricular].filter(Boolean).join("\n");
  const rolePattern = /\b(?:head|lead|leader|coordinator|president|vice president|captain|chair|secretary|organizer|organising committee|organizing committee|founder|co-founder|mentor)\b/i;

  return content.split(/\r?\n/).map((line) => line.replace(/^[•*\-\s]+/, "").trim()).filter((line) => rolePattern.test(line)).map((line) => {
    const parts = line.split(/\s+(?:[-–—|]|\bat\b)\s+/i).map((part) => part.trim()).filter(Boolean);
    return {
      role: parts.length > 1 ? parts.slice(0, -1).join(" - ") : parts[0],
      organization: parts.length > 1 ? parts.at(-1) : null,
      evidence: line
    };
  }).filter((item, index, items) => items.findIndex((candidate) => candidate.role.toLowerCase() === item.role.toLowerCase() && candidate.organization === item.organization) === index);
};

module.exports = { enrichProjectEvidence, extractLeadershipItems, sanitizeProjectName, TECHNOLOGY_CATALOG, ROLE_WEIGHTS };
