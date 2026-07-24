const assert = require("node:assert/strict");
const test = require("node:test");

const { evaluateProjects } = require("../services/readiness/projectEvaluator");
const { calculateReadinessScoreBreakdown } = require("../services/readiness/scoreCalculator");
const { getCompanyRules } = require("../services/readiness/companyRules");
const { buildEvidenceLists } = require("../services/readiness/evidenceBuilder");

const projectResume = (body) => `PROJECTS\n${body}\nEDUCATION\nEngineering`;

test("separates and evaluates the three current project formats", () => {
  const resume = projectResume(`Mody Map: A guide to Campus (Aug 2025 - Dec 2025)
• Developed a campus navigation website using HTML, CSS, JavaScript and Python backend.
WallScout Wall (Full Stack) - https://wall.vercel.app (June 2025 - July 2025)
• Built secure authentication and approval workflows.
• Tech used: React, TypeScript, Tailwind CSS, Vercel, PostgreSQL.
Personal Portfolio Website - https://portfolio.vercel.app (April 2025 - May 2025)
• Built a responsive portfolio using React, TypeScript, Tailwind CSS, Vite and Vercel.`);

  const result = evaluateProjects(resume, "Full-Stack Engineer", "product");
  assert.equal(result.projectCount, 3);
  assert.deepEqual(result.projectSummaries.map(({ name }) => name), [
    "Mody Map: A guide to Campus",
    "WallScout Wall Full Stack",
    "Personal Portfolio Website"
  ]);
  assert.equal(result.projectSummaries[0].capabilities.backend, true);
  assert.equal(result.projectSummaries[1].capabilities.authentication, true);
  assert.equal(result.projectSummaries[1].capabilities.deployment, true);
  assert.equal(result.projectSummaries[2].capabilities.deployment, true);
  assert.equal(result.projectSummaries[2].capabilities.backend, false);
  assert.deepEqual({
    frontend: result.capabilities.frontend,
    backend: result.capabilities.backend,
    authentication: result.capabilities.authentication,
    deployment: result.capabilities.deployment,
    cloud: result.capabilities.cloud,
    machineLearning: result.capabilities.machineLearning,
    dataEngineering: result.capabilities.dataEngineering,
    scalability: result.capabilities.scalability
  }, {
    frontend: true,
    backend: true,
    authentication: true,
    deployment: true,
    cloud: false,
    machineLearning: false,
    dataEngineering: false,
    scalability: false
  });
});

test("distinguishes application deployment from cloud platforms", () => {
  const vercel = evaluateProjects(projectResume("React App (Jan 2025 - Feb 2025)\n• Deployed React application on Vercel."), "Frontend Developer", "product");
  assert.equal(vercel.capabilities.deployment, true);
  assert.equal(vercel.capabilities.cloud, false);

  const aws = evaluateProjects(projectResume("API Service (Jan 2025 - Feb 2025)\n• Deployed backend API on AWS EC2."), "Backend Developer", "product");
  assert.equal(aws.capabilities.deployment, true);
  assert.equal(aws.capabilities.cloud, true);
});

test("does not infer data engineering from PostgreSQL CRUD", () => {
  const result = evaluateProjects(projectResume("CRUD App (Jan 2025 - Feb 2025)\n• Built PostgreSQL CRUD APIs."), "Backend Developer", "product");
  assert.equal(result.capabilities.dataEngineering, false);
});

test("detects an explicit recommendation engine", () => {
  const result = evaluateProjects(projectResume("Recommendations (Jan 2025 - Feb 2025)\n• Built a recommendation engine using collaborative filtering."), "ML Engineer", "product");
  assert.equal(result.capabilities.machineLearning, true);
  assert.equal(result.capabilities.dataEngineering, true);
});

test("detects an explicit TensorFlow project", () => {
  const result = evaluateProjects(projectResume("Vision Model (Jan 2025 - Feb 2025)\n• Built a computer vision model with TensorFlow."), "ML Engineer", "product");
  assert.equal(result.capabilities.machineLearning, true);
});

test("keeps authentication scoped to the project that contains its evidence", () => {
  const result = evaluateProjects(projectResume(`Secure App (Jan 2025 - Feb 2025)
• Built secure authentication with React and PostgreSQL.
Public Site (Mar 2025 - Apr 2025)
• Built a React portfolio and deployed it on Vercel.`), "Full-Stack Engineer", "product");

  assert.equal(result.projectSummaries[0].capabilities.authentication, true);
  assert.equal(result.projectSummaries[1].capabilities.authentication, false);
});

test("does not leak a following Technical Skills & Tools section into the last project", () => {
  const resume = `PROJECTS
Portfolio (Jan 2025 - Feb 2025)
• Built and deployed a React portfolio on Vercel.
TECHNICAL SKILLS & TOOLS
MySQL Workbench
EDUCATION
Engineering`;
  const result = evaluateProjects(resume, "Frontend Developer", "product");

  assert.equal(result.projectSummaries[0].capabilities.frontend, true);
  assert.equal(result.projectSummaries[0].capabilities.deployment, true);
  assert.equal(result.projectSummaries[0].capabilities.backend, false);
});

test("requires deployment evidence", () => {
  const result = evaluateProjects(projectResume("React App (Jan 2025 - Feb 2025)\n• Built a responsive React interface."), "Frontend Developer", "product");
  assert.equal(result.capabilities.deployment, false);
});

test("a new non-ML resume does not inherit previous capabilities", () => {
  const oldResult = evaluateProjects(projectResume("AI Project (Jan 2025 - Feb 2025)\n• Built a machine learning recommendation engine."), "ML Engineer", "product");
  const newResult = evaluateProjects(projectResume("React App (Jan 2025 - Feb 2025)\n• Built a React and PostgreSQL CRUD application."), "Frontend Developer", "product");
  assert.equal(oldResult.capabilities.machineLearning, true);
  assert.equal(newResult.capabilities.machineLearning, false);
  assert.equal(newResult.capabilities.dataEngineering, false);
});

test("adds verified resume contributions to the profile score", () => {
  const companyRules = getCompanyRules("Product Based").rules;
  const resumeEvidence = {
    leadership: { exists: true },
    projects: {
      projectCount: 3,
      capabilities: {
        frontend: true,
        backend: true,
        authentication: true,
        deployment: true,
        cloud: false,
        machineLearning: false,
        dataEngineering: false,
        scalability: false
      }
    }
  };
  const result = calculateReadinessScoreBreakdown({
    dsa: "Intermediate",
    dbms: "Beginner",
    os: "Intermediate",
    networks: "Beginner",
    aptitude: "Intermediate",
    communication: "Average"
  }, { preparationTimelineMonths: 6 }, 8.2, "Full-Stack Engineer", companyRules, resumeEvidence);

  assert.equal(result.score, 54);
  assert.equal(result.negativeContributions.length, 0);
});

test("does not emit a missing-deployment weakness when deployment is present", () => {
  const evidence = buildEvidenceLists({
    skills: {},
    timeline: {},
    resumeText: "Resume supplied"
  }, {
    internship: { exists: false },
    leadership: { exists: false },
    research: { exists: false },
    competitiveProgramming: { exists: false },
    hackathons: { exists: false },
    openSource: { exists: false },
    hasGitHub: true,
    certifications: { exists: false, count: 0 },
    detectedTechnologies: [],
    projects: {
      projectCount: 1,
      evaluatedProjects: [],
      capabilities: {
        deployment: true,
        cloud: false,
        scalability: false
      },
      projectSummaries: [],
      complexity: "Intermediate",
      overallProjectQuality: "Moderate"
    }
  }, {}, true);

  assert.equal(evidence.resumeWeaknesses.includes("deploymentMissing"), false);
  assert.equal(evidence.resumeWeaknesses.includes("cloudMissing"), true);
  assert.equal(evidence.resumeWeaknesses.includes("scalabilityMissing"), true);
});

test("builds structured strength facts without raw technology labels", () => {
  const evidence = buildEvidenceLists({
    skills: {}, timeline: {}, resumeText: "Resume supplied"
  }, {
    internship: { exists: false },
    leadership: { exists: true, role: "Coordinator", organization: "Enginium" },
    research: { exists: false },
    competitiveProgramming: { exists: false },
    hackathons: { exists: false },
    openSource: { exists: false },
    hasGitHub: true,
    certifications: { exists: false, count: 0 },
    detectedTechnologies: ["react", "typescript", "postgresql", "python"],
    projects: {
      projectCount: 2,
      capabilities: { frontend: true, backend: true, authentication: true, deployment: true, cloud: false, scalability: false },
      projectSummaries: [
        { capabilities: { frontend: true, backend: true, authentication: true, deployment: true } },
        { capabilities: { frontend: true, backend: false, authentication: false, deployment: true } }
      ],
      complexity: "Intermediate",
      overallProjectQuality: "Moderate"
    }
  }, {}, false);

  assert.deepEqual(evidence.strengthFacts, []);
  assert.equal(evidence.resumeStrengths.experience.some((item) => item.startsWith("Project technology:")), false);
});
