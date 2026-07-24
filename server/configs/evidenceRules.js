/**
 * server/configs/evidenceRules.js
 * CENTRALIZED PLATFORM PROFILES, THRESHOLDS, & WEIGHT CONFIGURATIONS
 */

module.exports = {
  profileThresholds: {
    cgpa: {
      criticalFiltrationLimit: 7.5,
      exceptionalStandingLimit: 9.0,
      severeCutoffZone: 7.0
    },
    timeline: {
      criticalRunwayMonths: 3,
      longRunwayMonths: 10,
      moderateRunwayMonths: 7
    },
    skills: {
      minimumDsaForElite: "advanced",
      minimumOsForElite: "intermediate"
    },
    communicationRankings: {
      "weak": 0,
      "average": 1,
      "strong": 2
    }
  }
};