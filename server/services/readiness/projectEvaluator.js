/**
 * server/services/readiness/projectEvaluator.js
 * FINAL PLATFORM STABILIZATION PASS — REGRESSION IMMUNE DETECTOR (ARCHITECTURE FROZEN)
 */

const containsSignal = (text, signal) => new RegExp(
  `(?:^|[^a-z0-9])${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`,
  "i"
).test(text);
const { enrichProjectEvidence } = require("./structuredProjectEvidence");

const extractIndividualProjectBlocks = (resumeText) => {
  if (!resumeText) return [];

  // -------- Locate PROJECTS section --------
  const lines = resumeText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const projectHeading = /^(?:PROJECTS?|ACADEMIC PROJECTS?|PERSONAL PROJECTS?|SELECTED PROJECTS?|PROJECT EXPERIENCE|PORTFOLIO|TECHNICAL PROJECTS?)$/i;
  const sectionHeading = /^(EXTRA[- ]?CURRICULAR.*|CERTIFICATIONS?|ACHIEVEMENTS?|EDUCATION|(?:TECHNICAL )?SKILLS?(?:\s*&\s*TOOLS?)?|WORK EXPERIENCE|EXPERIENCE|LEADERSHIP|POSITIONS? OF RESPONSIBILITY|ACTIVITIES)$/i;

  const start = lines.findIndex(line =>
    projectHeading.test(line)
  );

  if (start === -1) return [];

  const end = lines.findIndex((line, index) =>
    index > start &&
    sectionHeading.test(line)
  );

  const projectLines =
    end === -1
      ? lines.slice(start + 1)
      : lines.slice(start + 1, end);

  const projects = [];

  let currentProject = [];

  const isProjectTitle = (line) => {

    if (line.startsWith("TechStack")) return false;

    if (line.startsWith("•")) return false;

    if (/^[•*-]\s*/.test(line)) return false;

    if (line.length < 4) return false;

    if (line.includes("|")) return true;

    if (/\(\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\s*[-–—]\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\s*\)/i.test(line)) return true;

    if (/^(?:built|implemented|developed|designed|created|optimized|deployed|integrated|used|using|tech stack|technologies)\b/i.test(line)) return false;
    if (/[.!?]$/.test(line)) return false;
    const words = line.split(/\s+/);
    const titleLikeWords = words.filter((word) => /^[A-Z0-9][A-Za-z0-9+#.-]*$/.test(word)).length;
    return words.length <= 7 && titleLikeWords >= Math.ceil(words.length / 2);
  };

  for (const line of projectLines) {

    if (isProjectTitle(line)) {

      if (currentProject.length > 0) {
        projects.push(currentProject.join("\n"));
      }

      currentProject = [line];

      continue;
    }

    currentProject.push(line);
  }

  if (currentProject.length > 0) {
    projects.push(currentProject.join("\n"));
  }

  return projects;
};

const evaluateSingleProject = (projectText, canonicalRole, selectedCompanyKey) => {
  const text = projectText.toLowerCase();
  const hasDatabase =
[
"postgresql",
"mysql",
"mongodb",
"sqlite",
"firebase",
"supabase",
"prisma",
"sequelize"
].some(db => containsSignal(text, db));
  const signals = {
    backend: [
  "node.js",
  "express",
  "nestjs",
  "spring",
  "spring boot",
  "django",
  "flask",
  "fastapi",
  "laravel",

  "rest api",
  "graphql",

  "postgresql",
  "mysql",
  "mongodb",
  "prisma",
  "sequelize",
  "typeorm",

  "jwt",
  "authentication",
  "bcrypt",

  "redis",
  "kafka",
  "rabbitmq",

  "microservices",
  "grpc",

  "server",
  "backend",

  "api"
],
    frontend: [
  "frontend",
  "front end",
  "react",
  "next.js",
  "next",
  "vue",
  "angular",
  "tailwind",
  "tailwindcss",
  "html",
  "css",
  "javascript",
  "typescript",
  "vite",
  "zustand",
  "redux",
  "redux toolkit",
  "react query",
  "tanstack query",
  "shadcn",
  "framer motion",
  "axios"
],
    verbs: ["built", "implemented", "developed", "designed", "created", "optimized", "architected", "integrated", "deployed", "scaled"],
    mlAi: [

  "artificial intelligence",

  "machine learning",

  "deep learning",

  "tensorflow",

  "pytorch",

  "scikit",

  "llm",

  "gemini",

  "openai",

  "langchain",

  "rag",

  "embedding",

  "vector",

  "pinecone",

  "chromadb",

  "bedrock",

  "prompt engineering",

  "fine tuning",

  "recommendation",

  "nlp",

  "bert",

  "transformer"
],
    analytics: ["data pipeline", "etl pipeline", "data processing", "large-scale data", "recommendation engine", "recommendation system", "collaborative filtering", "content-based filtering", "feature engineering", "data warehouse", "apache spark", "kafka", "bigquery", "snowflake", "data modeling"],
    realtime: ["websocket", "socket.io", "webrtc", "streaming", "operational transformation", "crdt", "sse"],
    scalability: ["scalability", "load balancer", "nginx", "rate limiter", "optimization", "caching", "indexing", "performance", "throughput", "latency"],
    frontendArchitecture: [
      "component architecture", "reusable components", "state management", "client-side routing", "performance optimization", 
      "responsive design", "api integration", "custom hooks", "context api", "dynamic rendering", "react router", "redux toolkit", 
      "usecontext", "usereducer", "react hooks", "fetch api", "material ui", "chakra ui", "bootstrap", "responsive ui", "spa", 
      "lazy loading", "code splitting", "form validation"
    ],
    authentication: [
      "jwt", "oauth", "oauth2", "firebase auth", "passport.js", "clerk", "supabase auth", "nextauth", "session authentication", 
      "authentication middleware", "role based access control", "rbac", "access token", "refresh token", "bearer token", "authentication apis",
      "secure login", "user authentication", "encryption", "bcrypt", "hashing","secure authentication","login","signup","authorization"
    ]
  };

  const hasBackend =
signals.backend.some(k => containsSignal(text, k))
||
(
    text.includes("api")
    &&
    text.includes("database")
);
  const hasFrontend =
signals.frontend.some(k => containsSignal(text, k))
||
(
    text.includes("responsive")
    &&
    text.includes("interface")
);
  const hasVerbs = signals.verbs.some(k => text.includes(k));
  const mlMatches = signals.mlAi.filter((signal) => containsSignal(text, signal)).length;

const hasMlAi =
  mlMatches >= 2 ||
  ["tensorflow", "pytorch", "scikit", "scikit-learn", "neural network", "computer vision", "nlp"]
    .some((signal) => containsSignal(text, signal)) ||
  containsSignal(text, "machine learning") ||
  containsSignal(text, "artificial intelligence") ||
  containsSignal(text, "deep learning") ||
  containsSignal(text, "recommendation engine") ||
  containsSignal(text, "recommendation system");
  const hasAnalytics = signals.analytics.some((signal) => containsSignal(text, signal));
  const hasRealtime = signals.realtime.some(k => text.includes(k));
  const hasScalability = signals.scalability.some(k => text.includes(k));
  const hasDeployment = ["deployed", "live link", "vercel", "render", "heroku", "netlify", "aws", "gcp", "azure", "docker", "kubernetes", "ci/cd"].some(k => text.includes(k));
  const hasFrontendArch = signals.frontendArchitecture.some(k => text.includes(k));
  const hasAuth =
signals.authentication.some(k => containsSignal(text, k))
||
(
text.includes("authentication")
&&
text.includes("secure")
)
||
/\bauthentication\b|\bauthorization\b|\blogin\b|\bsignup\b|\bjwt\b|\bbcrypt\b/i.test(text);

  let complexity = "Basic";
  let backendDepth = (hasBackend || hasScalability) && hasVerbs;
  let frontendDepth = hasFrontend; 

  if (canonicalRole === "ML Engineer" || canonicalRole === "Data Scientist") {
    let mlEngineeringScore = 0;
    if (hasMlAi) mlEngineeringScore += 2;
    if (hasVerbs) mlEngineeringScore += 1;
    if (hasDeployment) mlEngineeringScore += 1;
    if (hasBackend || hasScalability) mlEngineeringScore += 1;
    if (text.includes("pipeline") || text.includes("fine-tuning") || text.includes("inference")) mlEngineeringScore += 2;
    
    complexity = mlEngineeringScore >= 5 ? "Advanced" : mlEngineeringScore >= 2 ? "Intermediate" : "Basic";
  } else if (canonicalRole === "Data Analyst") {
    let analyticsEngineeringScore = 0;
    if (hasAnalytics) analyticsEngineeringScore += 2;
    if (hasVerbs) analyticsEngineeringScore += 1;
    if (hasBackend || hasScalability) analyticsEngineeringScore += 1;
    if (text.includes("etl") || text.includes("dashboard") || text.includes("sql")) analyticsEngineeringScore += 2;
    
    complexity = analyticsEngineeringScore >= 4 ? "Advanced" : analyticsEngineeringScore >= 2 ? "Intermediate" : "Basic";
  } else if (canonicalRole === "Frontend Developer") {
    let feEngineeringScore = 0;
    if (hasFrontend) feEngineeringScore += 2;
    if (hasFrontendArch) feEngineeringScore += 3; 
    if (hasVerbs) feEngineeringScore += 1;
    if (hasRealtime) feEngineeringScore += 1;
    if (hasAuth) feEngineeringScore += 1;
    
    complexity = feEngineeringScore >= 6 ? "Advanced" : feEngineeringScore >= 4 ? "Intermediate" : "Basic";
  } else if (canonicalRole === "Backend Developer") {
    let beEngineeringScore = 0;
    if (hasBackend) beEngineeringScore += 2;
    if (hasScalability) beEngineeringScore += 2;
    if (hasRealtime) beEngineeringScore += 1;
    if (hasAuth) beEngineeringScore += 1;
    if (hasDeployment) beEngineeringScore += 1;
    if (hasVerbs) beEngineeringScore += 1;
    
    complexity = beEngineeringScore >= 6 ? "Advanced" : beEngineeringScore >= 3 ? "Intermediate" : "Basic";
  } else {
    let sdeEngineeringScore = 0;
    if (hasBackend || hasDatabase || hasScalability)
    sdeEngineeringScore += 2;
    if (hasFrontend || hasFrontendArch) sdeEngineeringScore += 2;
    if (hasAuth || hasRealtime) sdeEngineeringScore += 1;
    if (hasDeployment) sdeEngineeringScore += 1;
    if (hasVerbs) sdeEngineeringScore += 1;

    complexity = sdeEngineeringScore >= 5 ? "Advanced" : sdeEngineeringScore >= 2 ? "Intermediate" : "Basic";
  }

  let companyFit = "Acceptable";
  if (selectedCompanyKey === "maang") {
    companyFit = (complexity === "Advanced") ? "Excellent" : "Below Target";
  } else if (selectedCompanyKey === "product") {
    companyFit = (complexity === "Advanced" || complexity === "Intermediate") ? "Excellent" : "Below Target";
  } else if (selectedCompanyKey === "startup") {
    companyFit = (complexity === "Advanced" || complexity === "Intermediate" || hasDeployment) ? "Excellent" : "Acceptable";
  } else if (selectedCompanyKey === "service") {
    companyFit = (complexity !== "Basic") ? "Excellent" : "Acceptable";
  }

  const hasDistributedSystems = [
  "microservices",
  "kafka",
  "rabbitmq",
  "grpc",
  "distributed",
  "event driven",
  "pub sub",
  "message queue",
  "service discovery"
].some(k => text.includes(k));

// ---------------- Project Metadata ----------------

const projectName =
  projectText
    .split("\n")[0]
    .split("|")[0]
    .split("—")[0]
    .trim();
    
let projectType = "Software Project";

if (
    hasFrontend &&
    hasBackend &&
    hasMlAi
) {
    projectType = "AI-powered Full Stack Web Application";
}
else if (
    hasFrontend &&
    hasBackend
) {
    projectType = "Full Stack Web Application";
}
else if (hasMlAi) {
    projectType = "Machine Learning / AI Project";
}
else if (
    ["android","flutter","react native","kotlin","swift"]
        .some(k => text.includes(k))
) {
    projectType = "Mobile Application";
}
else if (
    ["unity","unreal","godot"]
        .some(k => text.includes(k))
) {
    projectType = "Game Development";
}
else if (hasFrontend) {
    projectType = "Frontend Application";
}
else if (hasBackend) {
    projectType = "Backend Service";
}

else if (
  ["android","flutter","react native","kotlin","swift"]
    .some(k => text.includes(k))
) {
  projectType = "Mobile Application";
}
else if (
  ["unity","unreal","godot"]
    .some(k => text.includes(k))
) {
  projectType = "Game Development";
}
else if (
  hasFrontend &&
  hasBackend
) {
  projectType = "Full Stack Web Application";
}
else if (hasFrontend) {
  projectType = "Frontend Application";
}
else if (hasBackend) {
  projectType = "Backend Service";
}

return {

  name: projectName,

  type: projectType,

  complexity,

  companyFit,

  capabilities: {

    frontend: hasFrontend,

    backend: hasBackend,

    authentication: hasAuth,

    deployment: hasDeployment,

    cloud:
      ["aws","gcp","azure","docker","kubernetes","ec2","s3"]
      .some(k => text.includes(k)),

    machineLearning: hasMlAi,

    dataEngineering: hasAnalytics,

    realtime: hasRealtime,

    distributedSystems: hasDistributedSystems,

    scalability: hasScalability,

    mobile:
      ["android","ios","flutter","react native","kotlin","swift"]
      .some(k => text.includes(k)),

    gameDevelopment:
      ["unity","unreal","godot","opengl","directx"]
      .some(k => text.includes(k)),

    embeddedSystems:
      ["arduino","raspberry pi","stm32","embedded c","verilog","fpga"]
      .some(k => text.includes(k)),

    cybersecurity:
      ["penetration testing","vulnerability","wireshark","metasploit","owasp"]
      .some(k => text.includes(k))
  }

};
};

const evaluateProjects = (resumeText, canonicalRole, selectedCompanyKey) => {
  const aggregated = {
  projectCount: 0,
  complexity: "Basic",
  deployment: false,
  architectureExposure: false,
  cloudExposure: false,
  systemDesignExposure: false,
  overallProjectQuality: "Low",

  capabilities: {
    frontend: false,
    backend: false,
    authentication: false,
    deployment: false,
    cloud: false,
    machineLearning: false,
    dataEngineering: false,
    realtime: false,
    distributedSystems: false,
    scalability: false,
    mobile: false,
    gameDevelopment: false,
    embeddedSystems: false,
    cybersecurity: false
  },
  projectSummaries: [],
  evaluatedProjects: []
};
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim() === "") {
    return aggregated;
  }

  const projectBlocks = extractIndividualProjectBlocks(resumeText);

  if (projectBlocks.length === 0) {
    aggregated.projectCount = 0; 
    return aggregated;
  }

  aggregated.projectCount = projectBlocks.length;
  const singleEvaluations = projectBlocks.map((block) => enrichProjectEvidence(
    block,
    evaluateSingleProject(block, canonicalRole, selectedCompanyKey),
    canonicalRole
  ));
  aggregated.evaluatedProjects = singleEvaluations;
  aggregated.projectSummaries = singleEvaluations.map(project => ({

  name: project.name,

  type: project.type,

  complexity: project.complexity,
  technologies: project.technologies,
  unknownTechnologies: project.unknownTechnologies,
  methods: project.methods,
  evidence: project.evidence,
  complexityIndicators: project.complexityIndicators,
  outcomeIndicators: project.outcomeIndicators,
  roleRelevance: project.roleRelevance,
  capabilities: project.capabilities
}));

  singleEvaluations.forEach(project => {

  Object.entries(project.capabilities).forEach(([key, value]) => {

    if (value) {
      aggregated.capabilities[key] = true;
    }

  });

});

  aggregated.deployment = singleEvaluations.some(p => p.capabilities.deployment);
  aggregated.cloudExposure = singleEvaluations.some(p => p.capabilities.cloud);
  aggregated.architectureExposure = singleEvaluations.some(p => p.complexity === "Advanced" || p.capabilities.distributedSystems);
  aggregated.systemDesignExposure = singleEvaluations.some(p => p.capabilities.scalability || p.capabilities.distributedSystems);

  const advancedCount = singleEvaluations.filter(p => p.complexity === "Advanced").length;
  const intermediateCount = singleEvaluations.filter(p => p.complexity === "Intermediate").length;

  if (advancedCount >= 1) {
    aggregated.complexity = "Advanced";
    aggregated.overallProjectQuality = "High";
  } else if (intermediateCount >= 1 || singleEvaluations.length >= 2) {
    aggregated.complexity = "Intermediate";
    aggregated.overallProjectQuality = "Moderate";
  }

  return aggregated;
};

module.exports = { evaluateProjects };
