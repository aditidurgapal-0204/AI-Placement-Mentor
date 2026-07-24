const SCHEMA_VERSION = "2.1";
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isString = (v) => typeof v === "string" && v.trim().length > 0;
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

const validateInsight = (item, path, errors) => {
  if (!isObject(item)) return errors.push(`${path} must be an object`);
  if (!isString(item.id)) errors.push(`${path}.id is required`);
  if (!isString(item.type)) errors.push(`${path}.type is required`);
  if (!isObject(item.facts)) errors.push(`${path}.facts is required`);
  if (!isObject(item.confidence) || !isNumber(item.confidence.value)
    || item.confidence.value < 0 || item.confidence.value > 1) {
    errors.push(`${path}.confidence.value must be between zero and one`);
  }
  if (!isObject(item.internalTrace)) errors.push(`${path}.internalTrace is required`);
};

const validateMentorAnalysisV2 = (snapshot) => {
  const errors = [];
  if (!isObject(snapshot)) return { valid: false, errors: ["snapshot must be an object"] };

  if (!isObject(snapshot.metadata)) errors.push("metadata is required");
  else {
    ["id", "requestId", "createdAt"].forEach((f) => {
      if (!isString(snapshot.metadata[f])) errors.push(`metadata.${f} is required`);
    });
    if (snapshot.metadata.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`metadata.schemaVersion must be ${SCHEMA_VERSION}`);
    }
  }

  if (!isObject(snapshot.context)) errors.push("context is required");
  if (!isObject(snapshot.readiness)) errors.push("readiness is required");
  else if (!isNumber(snapshot.readiness.score) || snapshot.readiness.score < 0 || snapshot.readiness.score > 100) {
    errors.push("readiness.score must be between zero and one hundred");
  }

  ["strengths", "scoreDrivers", "scoreBlockers", "careerRisks"].forEach((name) => {
    if (!Array.isArray(snapshot[name])) errors.push(`${name} must be an array`);
    else snapshot[name].forEach((item, i) => validateInsight(item, `${name}[${i}]`, errors));
  });

  (snapshot.scoreDrivers || []).forEach((item, i) => {
    if (item.scoring?.affectsCurrentScore !== true || !isNumber(item.scoring?.earnedPoints)
      || item.scoring.earnedPoints <= 0) errors.push(`scoreDrivers[${i}] has invalid scoring`);
  });

  (snapshot.scoreBlockers || []).forEach((item, i) => {
    const gap = isNumber(item.scoring?.gapPoints) && item.scoring.gapPoints > 0;
    const penalty = isNumber(item.scoring?.penaltyPoints) && item.scoring.penaltyPoints < 0;
    if (item.scoring?.affectsCurrentScore !== true || (!gap && !penalty)) {
      errors.push(`scoreBlockers[${i}] must contain a positive gap or negative penalty`);
    }
  });

  (snapshot.careerRisks || []).forEach((item, i) => {
    if (item.affectsCurrentScore !== false) {
      errors.push(`careerRisks[${i}].affectsCurrentScore must be false`);
    }
  });

  if (!isObject(snapshot.priority) || !isString(snapshot.priority.id)
    || !isObject(snapshot.priority.facts)) errors.push("priority is invalid");

  if (!isObject(snapshot.preparation) || !isString(snapshot.preparation.feasibility)
    || !Array.isArray(snapshot.preparation.verifiedInputs)) errors.push("preparation is invalid");

  return { valid: errors.length === 0, errors };
};

module.exports = { SCHEMA_VERSION, validateMentorAnalysisV2 };
