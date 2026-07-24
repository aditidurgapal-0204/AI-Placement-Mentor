import { AnalysisV2, parseAnalysisV2 } from "../lib/analysisV2Contract";
import { AdaptedAnalysisResponse, LegacyAnalysis } from "../lib/analysisResponseAdapter";
import { sanitizeProfileData } from "../lib/analysisResponseAdapter";

export type AnalysisStatus = "idle" | "loading" | "success" | "error";
export type ActiveAnalysisVersion = "legacy" | "v2" | null;
export type V2ValidationStatus = "valid" | "unavailable" | "invalid";

export interface StableAnalysisState {
  analysis: LegacyAnalysis | null;
  legacyAnalysis: LegacyAnalysis | null;
  analysisV2: AnalysisV2 | null;
  profileData: unknown;
  activeAnalysisVersion: ActiveAnalysisVersion;
  latestRequestedRequestId: string | null;
  latestAcceptedRequestId: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  v2ValidationStatus: V2ValidationStatus;
}

export const initialAnalysisState = (): StableAnalysisState => ({
  analysis: null, legacyAnalysis: null, analysisV2: null, profileData: null,
  activeAnalysisVersion: null, latestRequestedRequestId: null, latestAcceptedRequestId: null,
  analysisStatus: "idle", analysisError: null, v2ValidationStatus: "unavailable"
});

export const beginAnalysisState = (state: StableAnalysisState, requestId: string): StableAnalysisState => ({
  ...state,
  analysis: null,
  legacyAnalysis: null,
  analysisV2: null,
  profileData: null,
  activeAnalysisVersion: null,
  latestRequestedRequestId: requestId,
  analysisStatus: "loading",
  analysisError: null,
  v2ValidationStatus: "unavailable"
});

export const acceptAnalysisState = (
  state: StableAnalysisState,
  clientRequestId: string,
  response: AdaptedAnalysisResponse
): StableAnalysisState => {
  if (state.latestRequestedRequestId !== clientRequestId) return state;
  const legacy = structuredClone(response.legacyAnalysis);
  return {
    ...state,
    analysis: legacy,
    legacyAnalysis: structuredClone(response.legacyAnalysis),
    analysisV2: response.analysisV2 ? structuredClone(response.analysisV2) : null,
    profileData: sanitizeProfileData(response.profileData),
    activeAnalysisVersion: response.analysisV2 ? "v2" : "legacy",
    latestRequestedRequestId: null,
    latestAcceptedRequestId: response.analysisV2?.requestId || clientRequestId,
    analysisStatus: "success",
    analysisError: response.v2ValidationStatus === "invalid" ? "Version 2 analysis was unavailable; legacy analysis remains active." : null,
    v2ValidationStatus: response.v2ValidationStatus
  };
};

export const failAnalysisState = (state: StableAnalysisState, requestId: string): StableAnalysisState => {
  if (state.latestRequestedRequestId !== requestId) return state;
  return { ...state, latestRequestedRequestId: null, analysisStatus: "error", analysisError: "Your placement analysis could not be generated." };
};

export const migrateAnalysisPersistedState = (persisted: unknown): StableAnalysisState => {
  const source = persisted && typeof persisted === "object" ? persisted as Record<string, unknown> : {};
  const migrated = initialAnalysisState();
  const legacy = source.legacyAnalysis || source.analysis;
  if (legacy && typeof legacy === "object") {
    migrated.analysis = structuredClone(legacy) as LegacyAnalysis;
    migrated.legacyAnalysis = structuredClone(legacy) as LegacyAnalysis;
    migrated.profileData = sanitizeProfileData(source.profileData ?? null);
    migrated.activeAnalysisVersion = "legacy";
    migrated.analysisStatus = "success";
  }
  try {
    if (source.analysisV2) {
      migrated.analysisV2 = parseAnalysisV2(source.analysisV2);
      migrated.activeAnalysisVersion = "v2";
      migrated.v2ValidationStatus = "valid";
      migrated.latestAcceptedRequestId = migrated.analysisV2.requestId;
    }
  } catch {
    migrated.analysisV2 = null;
    migrated.v2ValidationStatus = "invalid";
  }
  return migrated;
};
