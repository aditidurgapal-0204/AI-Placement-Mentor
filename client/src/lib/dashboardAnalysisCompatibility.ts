import { AnalysisV2 } from "./analysisV2Contract";
import { LegacyAnalysis } from "./analysisResponseAdapter";

const uniqueText = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const selectDashboardAnalysis = (
  legacyAnalysis: LegacyAnalysis | null,
  analysisV2: AnalysisV2 | null
): LegacyAnalysis | null => {
  if (!analysisV2) return legacyAnalysis;

  return {
    readinessScore: analysisV2.readiness.score,
    diagnosis: analysisV2.diagnosis,
    strengths: analysisV2.strengths.map(({ text }) => text),
    weaknesses: uniqueText([
      `First priority: ${analysisV2.firstPriority.text}`,
      ...analysisV2.scoreBlockers.map(({ text }) => text),
      ...analysisV2.careerRisks.map(({ text }) => text)
    ])
  };
};
