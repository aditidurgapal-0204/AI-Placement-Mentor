/**
 * server/services/readiness/companyRules.js
 * ENTERPRISE REQUIREMENT MATRIX
 */

const COMPANY_MODIFIERS = {
  maang: {
    baseAdjustment: 0,
    requiredSkills: { dsa: "advanced", os: "intermediate" },
    failurePenalty: -30,
    cgpaScale: 1.2
  },
  product: {
    baseAdjustment: 0,
    requiredSkills: { dsa: "intermediate" },
    failurePenalty: -15,
    cgpaScale: 1.0
  },
  startup: {
    baseAdjustment: 5, 
    requiredSkills: {},
    failurePenalty: 0,
    cgpaScale: 0.7 
  },
  service: {
    baseAdjustment: 0,
    requiredSkills: { aptitude: "intermediate", communication: "strong" },
    failurePenalty: -10,
    cgpaScale: 1.0
  }
};

const normalizeCompany = (companyType) => {
  const normalized = String(companyType || "").toLowerCase();
  if (normalized.includes("maang") || normalized.includes("faang")) return "maang";
  if (normalized.includes("startup")) return "startup";
  if (normalized.includes("service")) return "service";
  return "product"; 
};

const getCompanyRules = (companyType) => {
  const key = normalizeCompany(companyType);
  return {
    key, // ISSUE 1: Exporting normalized token key to prevent secondary calculations downstream
    rules: COMPANY_MODIFIERS[key],
    isEliteTarget: key === "maang" || key === "product"
  };
};

module.exports = { getCompanyRules };