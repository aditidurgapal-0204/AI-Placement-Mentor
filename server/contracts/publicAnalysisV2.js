const PUBLIC_ANALYSIS_VERSION = "2.0";

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "internalTrace", "canonicalEvidence", "scoreLedger", "evidenceIds", "contributionIds",
  "scoreEffect", "confidence", "rawEvidence", "resumeText", "technologies", "methods",
  "prompt", "groundingErrors", "token", "password", "email", "phone"
]);

const findForbiddenPublicKeys = (value, path = "analysisV2", findings = []) => {
  if (Array.isArray(value)) value.forEach((item, index) => findForbiddenPublicKeys(item, `${path}[${index}]`, findings));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) findings.push(`${path}.${key}`);
    findForbiddenPublicKeys(child, `${path}.${key}`, findings);
  });
  return findings;
};

module.exports = { PUBLIC_ANALYSIS_VERSION, FORBIDDEN_PUBLIC_KEYS, findForbiddenPublicKeys };
