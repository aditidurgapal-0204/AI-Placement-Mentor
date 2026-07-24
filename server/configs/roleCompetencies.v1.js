const VERSION = "1.0";

const ROLE_COMPETENCIES = Object.freeze({
  software_development_engineer: {
    onboardingValues: ["Software Development Engineer (SDE)"],
    competencies: { problemSolving: 5, softwareConstruction: 5, systemFoundations: 4, dataManagement: 3, communication: 3 }
  },
  frontend_developer: {
    onboardingValues: ["Frontend Developer"],
    competencies: { interfaceEngineering: 5, softwareConstruction: 4, accessibility: 4, integration: 3, communication: 4 }
  },
  backend_developer: {
    onboardingValues: ["Backend Developer"],
    competencies: { serviceEngineering: 5, dataManagement: 5, systemDesign: 4, security: 4, reliability: 4 }
  },
  full_stack_engineer: {
    onboardingValues: ["Full-Stack Engineer"],
    competencies: { softwareConstruction: 5, interfaceEngineering: 4, serviceEngineering: 4, dataManagement: 4, integration: 4 }
  },
  machine_learning_engineer: {
    onboardingValues: ["Machine Learning Engineer"],
    competencies: { machineLearning: 5, dataPreparation: 5, modelEvaluation: 4, problemSolving: 4, softwareConstruction: 3 }
  },
  data_scientist: {
    onboardingValues: ["Data Scientist"],
    competencies: { dataAnalysis: 5, statisticalReasoning: 5, machineLearning: 4, dataPreparation: 4, communication: 3 }
  },
  data_analyst: {
    onboardingValues: ["Data Analyst"],
    competencies: { dataAnalysis: 5, dataManagement: 4, visualization: 4, statisticalReasoning: 4, communication: 4 }
  },
  cloud_devops_engineer: {
    onboardingValues: ["Cloud / DevOps Engineer"],
    competencies: { infrastructure: 5, automation: 5, reliability: 5, security: 4, systemFoundations: 4 }
  },
  cybersecurity_analyst: {
    onboardingValues: ["Cybersecurity Analyst"],
    competencies: { security: 5, systemFoundations: 5, networking: 5, riskAnalysis: 4, communication: 3 }
  },
  associate_product_manager: {
    onboardingValues: ["Product Manager (Associate)"],
    competencies: { productReasoning: 5, communication: 5, analyticalReasoning: 4, leadership: 4, technicalFluency: 3 }
  },
  mobile_application_developer: {
    onboardingValues: ["Mobile App Developer (iOS/Android)"],
    competencies: { mobileEngineering: 5, softwareConstruction: 4, interfaceEngineering: 4, integration: 4, dataManagement: 3 }
  },
  embedded_iot_engineer: {
    onboardingValues: ["Embedded Systems / IoT Engineer"],
    competencies: { embeddedEngineering: 5, systemFoundations: 5, networking: 4, softwareConstruction: 4, reliability: 4 }
  }
});

module.exports = { VERSION, ROLE_COMPETENCIES };
