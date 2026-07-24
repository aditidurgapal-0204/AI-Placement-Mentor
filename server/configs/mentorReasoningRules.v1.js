const VERSION = "1.0";

const MENTOR_REASONING_RULES = Object.freeze({
  affectsReadinessScore: false,
  evidence: {
    acceptedStatuses: ["verified", "supported"],
    confidenceBands: {
      high: { minimum: 0.8 },
      medium: { minimum: 0.55 },
      low: { minimum: 0 }
    }
  },
  strengths: {
    minimum: 1,
    maximum: 6,
    grouping: {
      requireSharedCapabilityOrSource: true,
      maximumPublicEvidenceSummaries: 1
    },
    rankingWeights: {
      roleRelevance: 0.3,
      confidence: 0.25,
      evidenceDepth: 0.2,
      evidenceBreadth: 0.15,
      scoreContribution: 0.1
    }
  },
  blockers: {
    maximumScoreBlockers: 6,
    maximumCareerRisks: 6,
    scoreBlockerRequiresNegativeContribution: true,
    careerRiskRequiresScoreContribution: false
  },
  priority: {
    maximum: 1,
    rankingWeights: {
      scoreImpact: 0.3,
      roleRelevance: 0.25,
      employabilityImpact: 0.2,
      confidence: 0.15,
      preparationFeasibility: 0.1
    },
    allowedExpectedImpacts: ["readiness_score", "employability_confidence", "both"]
  },
  preparation: {
    verifiedInputs: ["timelineMonths", "dailyStudyHours", "currentReadiness", "requiredImprovement"],
    feasibilityBands: ["limited", "moderate", "strong"],
    capacityThresholds: { strong: 300, moderate: 120 },
    improvementThresholds: { substantial: 20, moderate: 10 },
    prohibitOutcomeGuarantees: true
  },
  capabilityGroups: {
    end_to_end_software_delivery: ["frontend", "backend", "databaseIntegration", "authentication", "deployment", "apiIntegration"],
    applied_machine_learning: ["machineLearning", "recommendationSystem", "dataPreprocessing", "featureEngineering", "modelEvaluation"],
    data_practice: ["dataAnalysis", "visualization", "dataEngineering", "databaseIntegration", "dataPreprocessing"],
    production_engineering: ["deployment", "cloud", "scalability", "distributedSystems", "systemDesign", "reliability", "infrastructure"],
    security_engineering: ["cybersecurity", "security", "authentication"],
    interface_engineering: ["frontend", "accessibility", "visualization", "interfaceEngineering"],
    service_engineering: ["backend", "apiIntegration", "databaseIntegration", "serviceEngineering"],
    mobile_engineering: ["mobile", "mobileEngineering"],
    embedded_engineering: ["embeddedSystems", "embeddedEngineering"]
  }
});

module.exports = { VERSION, MENTOR_REASONING_RULES };
