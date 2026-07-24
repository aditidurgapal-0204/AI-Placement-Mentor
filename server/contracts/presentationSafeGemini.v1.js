const DTO_VERSION = "2.0";
const FORBIDDEN_INPUT_KEYS = new Set([
  "resumeText", "projectDescription", "projectDescriptions", "methods", "rawEvidence",
  "evidenceIds", "contributionIds", "sourceText", "projectKey", "phone", "email",
  "password", "token", "conclusion", "studentMeaning", "roleConnection",
  "objective", "whyFirst", "meaning"
]);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isString = (v) => typeof v === "string" && v.trim().length > 0;

const findForbiddenKeys = (value, path = "dto", findings = []) => {
  if (Array.isArray(value)) value.forEach((v, i) => findForbiddenKeys(v, `${path}[${i}]`, findings));
  else if (isObject(value)) Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_INPUT_KEYS.has(key)) findings.push(`${path}.${key}`);
    findForbiddenKeys(child, `${path}.${key}`, findings);
  });
  return findings;
};

const validatePresentationSafeGeminiInput = (dto) => {
  const errors = [];
  if (!isObject(dto)) return { valid: false, errors: ["dto must be an object"] };
  if (dto.version !== DTO_VERSION) errors.push(`version must be ${DTO_VERSION}`);
  if (!isString(dto.analysisId)) errors.push("analysisId is required");
  if (!isObject(dto.context)) errors.push("context is required");
  if (!isObject(dto.readiness) || typeof dto.readiness.score !== "number") errors.push("readiness is invalid");

  ["strengths", "scoreBlockers", "careerRisks"].forEach((name) => {
    if (!Array.isArray(dto[name])) errors.push(`${name} must be an array`);
    else dto[name].forEach((item, i) => {
      if (!isObject(item) || !isString(item.id) || !isString(item.type) || !isObject(item.facts)) {
        errors.push(`${name}[${i}] must contain id, type and facts`);
      }
    });
  });

  if (!isObject(dto.priority) || !isString(dto.priority.id) || !isObject(dto.priority.facts)) {
    errors.push("priority is invalid");
  }

  findForbiddenKeys(dto).forEach((path) => errors.push(`${path} is forbidden`));
  if (JSON.stringify(dto).length > 24000) errors.push("dto exceeds payload limit");
  return { valid: errors.length === 0, errors };
};

const validatePresentationSafeGeminiOutput = (output, input) => {
  const errors = [];
  if (!isObject(output)) return { valid: false, errors: ["output must be an object"] };
  if (output.analysisId !== input.analysisId) errors.push("analysisId must match");
  if (!isString(output.diagnosis)) errors.push("diagnosis is required");

  ["strengths", "scoreBlockers", "careerRisks"].forEach((name) => {
    if (!Array.isArray(output[name])) return errors.push(`${name} must be an array`);
    const expected = (input[name] || []).map(({ id }) => id);
    const actual = output[name].map(({ insightId }) => insightId);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) errors.push(`${name} IDs/order must match`);
    output[name].forEach((item, i) => {
      if (!isString(item?.text)) errors.push(`${name}[${i}].text is required`);
    });
  });

  if (!isObject(output.priority) || output.priority.insightId !== input.priority.id
    || !isString(output.priority.text)) errors.push("priority is invalid");

  return { valid: errors.length === 0, errors };
};

module.exports = {
  DTO_VERSION,
  FORBIDDEN_INPUT_KEYS,
  findForbiddenKeys,
  validatePresentationSafeGeminiInput,
  validatePresentationSafeGeminiOutput
};
