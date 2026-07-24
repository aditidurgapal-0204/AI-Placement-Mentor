import { AnalysisV2, AnalysisV2ValidationError, parseAnalysisV2 } from "./analysisV2Contract";

export interface LegacyAnalysis {
  readinessScore: number;
  diagnosis: string;
  strengths: string[];
  weaknesses: string[];
  strengthFacts?: unknown[];
}

export interface AdaptedAnalysisResponse {
  legacyAnalysis: LegacyAnalysis;
  analysisV2: AnalysisV2 | null;
  v2ValidationStatus: "valid" | "unavailable" | "invalid";
  profileData: unknown;
}

export class FatalAnalysisResponseError extends Error {
  constructor(message = "The analysis response is invalid.") { super(message); this.name = "FatalAnalysisResponseError"; }
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = <T>(value: T): T => value === undefined ? value : structuredClone(value);
const sanitizeProfileData = (value: unknown): unknown => {
  if (!object(value)) return null;
  const skills = object(value.skills) ? {
    dsa: value.skills.dsa, dbms: value.skills.dbms, os: value.skills.os,
    networks: value.skills.networks, aptitude: value.skills.aptitude, communication: value.skills.communication
  } : undefined;
  const timeline = object(value.timeline) ? {
    preparationTimelineMonths: value.timeline.preparationTimelineMonths,
    dailyStudyHours: value.timeline.dailyStudyHours
  } : undefined;
  return {
    branch: value.branch, year: value.year, cgpa: value.cgpa,
    companyType: value.companyType, targetRole: value.targetRole,
    ...(skills ? { skills } : {}), ...(timeline ? { timeline } : {}),
    resumeAvailable: value.resumeAvailable === true
  };
};

export const parseLegacyAnalysis = (value: unknown): LegacyAnalysis => {
  if (!object(value)) throw new FatalAnalysisResponseError();
  if (typeof value.readinessScore !== "number" || !Number.isFinite(value.readinessScore)) throw new FatalAnalysisResponseError();
  if (typeof value.diagnosis !== "string" || !value.diagnosis.trim()) throw new FatalAnalysisResponseError();
  if (!Array.isArray(value.strengths) || !value.strengths.every((item) => typeof item === "string")) throw new FatalAnalysisResponseError();
  if (!Array.isArray(value.weaknesses) || !value.weaknesses.every((item) => typeof item === "string")) throw new FatalAnalysisResponseError();
  return {
    readinessScore: value.readinessScore,
    diagnosis: value.diagnosis,
    strengths: [...value.strengths],
    weaknesses: [...value.weaknesses],
    ...(Array.isArray(value.strengthFacts) ? { strengthFacts: clone(value.strengthFacts) } : {})
  };
};

export const adaptAnalysisResponse = (value: unknown): AdaptedAnalysisResponse => {
  if (!object(value) || value.success !== true) throw new FatalAnalysisResponseError();
  const legacyAnalysis = parseLegacyAnalysis(value.analysis);
  if (value.analysisV2 === undefined || value.analysisV2 === null) {
    return { legacyAnalysis, analysisV2: null, v2ValidationStatus: "unavailable", profileData: sanitizeProfileData(value.profileData) };
  }
  try {
    return { legacyAnalysis, analysisV2: parseAnalysisV2(value.analysisV2), v2ValidationStatus: "valid", profileData: sanitizeProfileData(value.profileData) };
  } catch (error) {
    if (!(error instanceof AnalysisV2ValidationError)) throw error;
    return { legacyAnalysis, analysisV2: null, v2ValidationStatus: "invalid", profileData: sanitizeProfileData(value.profileData) };
  }
};

export { sanitizeProfileData };
