/**
 * server/services/readiness/roleWeightsConfiguration.js
 * Deterministic role-aware readiness model.
 *
 * All category maximums total exactly 100 points:
 * technicalSkills 35, projects 25, academics 8, professionalExposure 10,
 * portfolio 8, communicationAptitude 6, certifications 3,
 * leadership 3, preparationCapacity 2.
 */

const LEVEL_MULTIPLIERS = Object.freeze({
  advanced: 1,
  intermediate: 0.58,
  beginner: 0.18,
  strong: 1,
  average: 0.55,
  weak: 0.15
});

const COMMON_CATEGORY_MAXIMUMS = Object.freeze({
  technicalSkills: 35,
  projects: 25,
  academics: 8,
  professionalExposure: 10,
  portfolio: 8,
  communicationAptitude: 6,
  certifications: 3,
  leadership: 3,
  preparationCapacity: 2
});

const ROLE_CONFIGS = Object.freeze({
  "Software Development Engineer": {
    technicalSkills: { dsa: 15, dbms: 7, os: 7, networks: 6 },
    communicationAptitude: { aptitude: 4, communication: 2 },
    projectSignals: {
      frontend: 1,
      backend: 1.15,
      authentication: 0.8,
      deployment: 0.9,
      cloud: 0.85,
      scalability: 1.1,
      distributedSystems: 1.1,
      realtime: 0.75,
      dataEngineering: 0.7,
      machineLearning: 0.65
    }
  },
  "Backend Developer": {
    technicalSkills: { dsa: 9, dbms: 11, os: 8, networks: 7 },
    communicationAptitude: { aptitude: 3, communication: 3 },
    projectSignals: {
      backend: 1.4,
      authentication: 1.15,
      deployment: 0.9,
      cloud: 1,
      scalability: 1.3,
      distributedSystems: 1.35,
      realtime: 0.9,
      dataEngineering: 1,
      frontend: 0.35
    }
  },
  "Frontend Developer": {
    technicalSkills: { dsa: 9, dbms: 5, os: 4, networks: 5 },
    supplementalTechnicalMaximum: 12,
    communicationAptitude: { aptitude: 2, communication: 4 },
    projectSignals: {
      frontend: 1.5,
      deployment: 1,
      authentication: 0.85,
      realtime: 0.85,
      backend: 0.55,
      scalability: 0.65,
      cloud: 0.55
    }
  },
  "ML Engineer": {
    technicalSkills: { dsa: 12, dbms: 8, os: 5, networks: 3 },
    supplementalTechnicalMaximum: 7,
    communicationAptitude: { aptitude: 4, communication: 2 },
    projectSignals: {
      machineLearning: 1.6,
      dataEngineering: 1.25,
      deployment: 0.8,
      backend: 0.65,
      cloud: 0.75,
      scalability: 0.75,
      frontend: 0.25
    }
  },
  "Data Analyst": {
    technicalSkills: { dsa: 5, dbms: 14, os: 3, networks: 3 },
    supplementalTechnicalMaximum: 10,
    communicationAptitude: { aptitude: 3, communication: 3 },
    projectSignals: {
      dataEngineering: 1.45,
      machineLearning: 0.8,
      deployment: 0.45,
      backend: 0.5,
      frontend: 0.45,
      cloud: 0.55,
      scalability: 0.4
    }
  }
});

const DEFAULT_ROLE = "Software Development Engineer";

const getRoleConfig = (targetRole) => ROLE_CONFIGS[targetRole] || ROLE_CONFIGS[DEFAULT_ROLE];

module.exports = {
  LEVEL_MULTIPLIERS,
  COMMON_CATEGORY_MAXIMUMS,
  ROLE_CONFIGS,
  DEFAULT_ROLE,
  getRoleConfig
};
