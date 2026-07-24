import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AdaptedAnalysisResponse, LegacyAnalysis } from "../lib/analysisResponseAdapter";
import {
  StableAnalysisState,
  acceptAnalysisState,
  beginAnalysisState,
  failAnalysisState,
  initialAnalysisState,
  migrateAnalysisPersistedState
} from "./analysisStoreModel";

interface AnalysisStore extends StableAnalysisState {
  beginAnalysis: (requestId: string) => void;
  acceptAnalysisResponse: (requestId: string, response: AdaptedAnalysisResponse) => boolean;
  failAnalysis: (requestId: string) => boolean;
  setAnalysisData: (data: { analysis: LegacyAnalysis; profileData: unknown; requestId?: string }) => void;
  clearAnalysisData: () => void;
}

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set, get) => ({
      ...initialAnalysisState(),
      beginAnalysis: (requestId) => set((state) => beginAnalysisState(state, requestId)),
      acceptAnalysisResponse: (requestId, response) => {
        if (get().latestRequestedRequestId !== requestId) return false;
        set((state) => acceptAnalysisState(state, requestId, response));
        return true;
      },
      failAnalysis: (requestId) => {
        if (get().latestRequestedRequestId !== requestId) return false;
        set((state) => failAnalysisState(state, requestId));
        return true;
      },
      setAnalysisData: ({ analysis, profileData, requestId }) => {
        const activeRequestId = requestId || get().latestRequestedRequestId;
        if (!activeRequestId) return;
        get().acceptAnalysisResponse(activeRequestId, {
          legacyAnalysis: structuredClone(analysis), analysisV2: null,
          v2ValidationStatus: "unavailable", profileData: structuredClone(profileData)
        });
      },
      clearAnalysisData: () => set(initialAnalysisState())
    }),
    {
      name: "placement-analysis-store",
      version: 3,
      migrate: (persistedState) => migrateAnalysisPersistedState(persistedState),
      partialize: (state) => ({
        analysis: state.analysis,
        legacyAnalysis: state.legacyAnalysis,
        analysisV2: state.analysisV2,
        profileData: state.profileData,
        activeAnalysisVersion: state.activeAnalysisVersion,
        latestAcceptedRequestId: state.latestAcceptedRequestId,
        v2ValidationStatus: state.v2ValidationStatus
      })
    }
  )
);
