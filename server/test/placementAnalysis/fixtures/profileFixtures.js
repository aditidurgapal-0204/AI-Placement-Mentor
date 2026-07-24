const { resumes } = require("./resumeFixtures");

const baseProfile = Object.freeze({
  branch: "Computer Science",
  year: "2027",
  cgpa: "8.2",
  companyType: "Product Based",
  targetRole: "Software Development Engineer",
  skills: Object.freeze({
    dsa: "Intermediate",
    dbms: "Intermediate",
    os: "Intermediate",
    networks: "Beginner",
    aptitude: "Intermediate",
    communication: "Strong"
  }),
  timeline: Object.freeze({
    preparationTimelineMonths: 6,
    dailyStudyHours: 4
  })
});

const profileWith = (overrides = {}) => ({
  ...baseProfile,
  ...overrides,
  skills: { ...baseProfile.skills, ...(overrides.skills || {}) },
  timeline: { ...baseProfile.timeline, ...(overrides.timeline || {}) }
});

const profiles = Object.freeze({
  fullStack: profileWith({ resumeText: resumes.fullStack }),
  machineLearning: profileWith({ targetRole: "ML Engineer", resumeText: resumes.machineLearning }),
  backend: profileWith({ targetRole: "Backend Developer", resumeText: resumes.backend }),
  frontend: profileWith({ targetRole: "Frontend Developer", resumeText: resumes.frontend }),
  unfamiliar: profileWith({ resumeText: resumes.unfamiliar }),
  sparse: profileWith({ resumeText: resumes.sparse }),
  leadershipHeavy: profileWith({ resumeText: resumes.leadershipHeavy }),
  noResume: profileWith({ resumeText: null })
});

const representativeFullStack = profileWith({
  targetRole: "Full-Stack Engineer",
  resumeText: resumes.representativeFullStack
});

module.exports = { baseProfile, profileWith, profiles, representativeFullStack };
