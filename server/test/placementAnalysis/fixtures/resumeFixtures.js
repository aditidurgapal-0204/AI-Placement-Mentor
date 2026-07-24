const withResumeSections = (projectBody, extra = "") => [
  "PROJECTS",
  projectBody,
  extra,
  "EDUCATION",
  "Bachelor of Engineering"
].filter(Boolean).join("\n");

const resumes = Object.freeze({
  fullStack: withResumeSections([
    "Commerce Platform",
    "Built a responsive frontend and REST API with database-backed authentication.",
    "Deployed the application for public use."
  ].join("\n")),
  machineLearning: withResumeSections([
    "Recommendation Engine",
    "Built a machine learning recommendation system using collaborative filtering, feature engineering, data preprocessing, and model evaluation."
  ].join("\n")),
  backend: withResumeSections([
    "Service Platform",
    "Built modular REST APIs with database integration, authentication, caching, and system design."
  ].join("\n")),
  frontend: withResumeSections([
    "Accessible Interface",
    "Built a responsive accessible interface with state management and deployed it for public use."
  ].join("\n")),
  unfamiliar: withResumeSections([
    "Workflow Tool",
    "Tech stack: NovaFrame, OrbitStore",
    "Built an automated workflow with API integration."
  ].join("\n")),
  sparse: "EDUCATION\nBachelor of Engineering\nSKILLS\nProblem solving",
  leadershipHeavy: withResumeSections(
    "Community Portal\nBuilt a responsive portal.",
    "EXTRA-CURRICULAR ACTIVITIES\nTechnical Team Coordinator - Engineering Society\nEvent Lead - Student Community"
  ),
  representativeFullStack: [
    "PROJECTS",
    "Campus Navigation Application",
    "Built mapping and routing features to help users navigate campus.",
    "Mural Management Platform",
    "Built a full-stack application with authentication, image handling, approval workflows and PostgreSQL.",
    "Developer Portfolio",
    "Built and deployed a responsive React and TypeScript portfolio.",
    "SKILLS",
    "Java, C, Python, JavaScript, TypeScript, React, Tailwind CSS, PostgreSQL",
    "EXTRA-CURRICULAR ACTIVITIES",
    "Technical Team Coordinator",
    "Public speaking, event anchoring and volunteering",
    "CERTIFICATIONS",
    "Programming Certification",
    "EDUCATION",
    "Bachelor of Engineering"
  ].join("\n")
});

module.exports = { resumes };
