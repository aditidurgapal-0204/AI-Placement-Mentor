export const ANALYSIS_V2_CONTRACT_VERSION = "2.0" as const;
export const LANGUAGE_SOURCES = ["gemini", "deterministic_fallback"] as const;
export const PREPARATION_FEASIBILITY = ["strong", "moderate", "limited"] as const;

export type LanguageSource = typeof LANGUAGE_SOURCES[number];
export type PreparationFeasibility = typeof PREPARATION_FEASIBILITY[number];

export interface AnalysisV2Insight {
  id: string;
  text: string;
}

export interface AnalysisV2 {
  analysisId: string;
  requestId: string;
  createdAt: string;
  contractVersion: typeof ANALYSIS_V2_CONTRACT_VERSION;
  languageSource: LanguageSource;
  readiness: {
    score: number;
    label: string;
    labelKey: string;
    nextLevel: { label: string; labelKey: string; pointsRequired: number };
    explanation: string;
  };
  diagnosis: string;
  strengths: AnalysisV2Insight[];
  scoreBlockers: AnalysisV2Insight[];
  careerRisks: AnalysisV2Insight[];
  firstPriority: { id: string; text: string; preparationFeasibility: PreparationFeasibility };
  preparation: { feasibility: PreparationFeasibility; improvementPotential: string };
  context: {
    targetRole: string;
    companyType: string;
    timelineMonths: number;
    dailyStudyHours: number;
    resumeProvided: boolean;
  };
}

const FORBIDDEN_KEYS = new Set([
  "canonicalEvidence", "resumeText", "evidenceIds", "contributionIds", "scoreLedger",
  "internalTrace", "scoreEffect", "groundingErrors", "prompt", "technologies", "methods"
]);

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new AnalysisV2ValidationError(`${field} must be a non-empty string.`);
  return value.trim();
};
const finite = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new AnalysisV2ValidationError(`${field} must be a finite number.`);
  return value;
};
const record = (value: unknown, field: string): Record<string, unknown> => {
  if (!object(value)) throw new AnalysisV2ValidationError(`${field} must be an object.`);
  return value;
};

const rejectForbiddenKeys = (value: unknown, path = "analysisV2"): void => {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectForbiddenKeys(item, `${path}[${index}]`));
  if (!object(value)) return;
  Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_KEYS.has(key)) throw new AnalysisV2ValidationError(`${path}.${key} is forbidden.`);
    rejectForbiddenKeys(child, `${path}.${key}`);
  });
};

const parseFeasibility = (value: unknown, field: string): PreparationFeasibility => {
  if (!PREPARATION_FEASIBILITY.includes(value as PreparationFeasibility)) throw new AnalysisV2ValidationError(`${field} is unsupported.`);
  return value as PreparationFeasibility;
};

const parseInsights = (value: unknown, field: string): AnalysisV2Insight[] => {
  if (!Array.isArray(value)) throw new AnalysisV2ValidationError(`${field} must be an array.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const source = record(entry, `${field}[${index}]`);
    const id = string(source.id, `${field}[${index}].id`);
    if (ids.has(id)) throw new AnalysisV2ValidationError(`${field} contains duplicate insight ID ${id}.`);
    ids.add(id);
    return { id, text: string(source.text, `${field}[${index}].text`) };
  });
};

export class AnalysisV2ValidationError extends Error {
  constructor(message: string) { super(message); this.name = "AnalysisV2ValidationError"; }
}

export const parseAnalysisV2 = (value: unknown): AnalysisV2 => {
  rejectForbiddenKeys(value);
  const source = record(value, "analysisV2");
  if (source.contractVersion !== ANALYSIS_V2_CONTRACT_VERSION) throw new AnalysisV2ValidationError("Unsupported analysisV2 contract version.");
  if (!LANGUAGE_SOURCES.includes(source.languageSource as LanguageSource)) throw new AnalysisV2ValidationError("Unsupported analysisV2 language source.");
  const readiness = record(source.readiness, "analysisV2.readiness");
  const nextLevel = record(readiness.nextLevel, "analysisV2.readiness.nextLevel");
  const score = finite(readiness.score, "analysisV2.readiness.score");
  const pointsRequired = finite(nextLevel.pointsRequired, "analysisV2.readiness.nextLevel.pointsRequired");
  if (score < 0 || score > 100) throw new AnalysisV2ValidationError("analysisV2.readiness.score must be between 0 and 100.");
  if (pointsRequired < 0) throw new AnalysisV2ValidationError("analysisV2.readiness.nextLevel.pointsRequired cannot be negative.");
  const createdAt = string(source.createdAt, "analysisV2.createdAt");
  if (Number.isNaN(Date.parse(createdAt))) throw new AnalysisV2ValidationError("analysisV2.createdAt must be a valid timestamp.");
  const priority = record(source.firstPriority, "analysisV2.firstPriority");
  const preparation = record(source.preparation, "analysisV2.preparation");
  const context = record(source.context, "analysisV2.context");
  if (typeof context.resumeProvided !== "boolean") throw new AnalysisV2ValidationError("analysisV2.context.resumeProvided must be boolean.");

  return {
    analysisId: string(source.analysisId, "analysisV2.analysisId"),
    requestId: string(source.requestId, "analysisV2.requestId"),
    createdAt,
    contractVersion: ANALYSIS_V2_CONTRACT_VERSION,
    languageSource: source.languageSource as LanguageSource,
    readiness: {
      score,
      label: string(readiness.label, "analysisV2.readiness.label"),
      labelKey: string(readiness.labelKey, "analysisV2.readiness.labelKey"),
      nextLevel: {
        label: string(nextLevel.label, "analysisV2.readiness.nextLevel.label"),
        labelKey: string(nextLevel.labelKey, "analysisV2.readiness.nextLevel.labelKey"),
        pointsRequired
      },
      explanation: string(readiness.explanation, "analysisV2.readiness.explanation")
    },
    diagnosis: string(source.diagnosis, "analysisV2.diagnosis"),
    strengths: parseInsights(source.strengths, "analysisV2.strengths"),
    scoreBlockers: parseInsights(source.scoreBlockers, "analysisV2.scoreBlockers"),
    careerRisks: parseInsights(source.careerRisks, "analysisV2.careerRisks"),
    firstPriority: {
      id: string(priority.id, "analysisV2.firstPriority.id"),
      text: string(priority.text, "analysisV2.firstPriority.text"),
      preparationFeasibility: parseFeasibility(priority.preparationFeasibility, "analysisV2.firstPriority.preparationFeasibility")
    },
    preparation: {
      feasibility: parseFeasibility(preparation.feasibility, "analysisV2.preparation.feasibility"),
      improvementPotential: string(preparation.improvementPotential, "analysisV2.preparation.improvementPotential")
    },
    context: {
      targetRole: string(context.targetRole, "analysisV2.context.targetRole"),
      companyType: string(context.companyType, "analysisV2.context.companyType"),
      timelineMonths: finite(context.timelineMonths, "analysisV2.context.timelineMonths"),
      dailyStudyHours: finite(context.dailyStudyHours, "analysisV2.context.dailyStudyHours"),
      resumeProvided: context.resumeProvided
    }
  };
};
