import { AnalysisV2 } from "./analysisV2Contract";
import { LegacyAnalysis } from "./analysisResponseAdapter";
import { presentStrengths } from "./strengthPresentation";

export interface DashboardAnalysisPresentation {
  readiness: { score: number; label: string; summary: string };
  diagnosis: string;
  strengths: { id: string; text: string }[];
  scoreBlockers: { id: string; text: string }[];
  careerRisks: { id: string; text: string }[];
  limitations: string[];
  firstPriority: { id: string; text: string } | null;
  context: { targetRole: string; companyType: string } | null;
}

const normalizedWords = (value: string): Set<string> => new Set(value.toLowerCase()
  .replace(/[^a-z0-9\s-]/g, " ")
  .split(/\s+/)
  .filter((word) => word.length > 3 && !["your", "this", "that", "with", "from", "into", "first"].includes(word)));

const semanticOverlap = (left: string, right: string): number => {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.min(a.size, b.size);
};

const selectLimitations = (items: string[], priority: string | null): string[] => {
  const selected: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text || (priority && semanticOverlap(text, priority) >= 0.18)) continue;
    if (selected.some((existing) => semanticOverlap(existing, text) >= 0.55)) continue;
    selected.push(text);
    if (selected.length === 3) break;
  }
  return selected;
};

export const selectDashboardAnalysis = (
  legacyAnalysis: LegacyAnalysis | null,
  analysisV2: AnalysisV2 | null
): DashboardAnalysisPresentation | null => {
  if (analysisV2) {
    const firstPriority = analysisV2.firstPriority.text.trim();
    return {
      readiness: {
        score: analysisV2.readiness.score,
        label: analysisV2.readiness.label,
        summary: analysisV2.readiness.explanation
      },
      diagnosis: analysisV2.diagnosis,
      strengths: analysisV2.strengths.map(({ id, text }) => ({ id, text: text.trim() })).filter(({ text }) => Boolean(text)),
      scoreBlockers: analysisV2.scoreBlockers.map(({ id, text }) => ({ id, text: text.trim() })).filter(({ text }) => Boolean(text)),
      careerRisks: analysisV2.careerRisks.map(({ id, text }) => ({ id, text: text.trim() })).filter(({ text }) => Boolean(text)),
      limitations: selectLimitations([
        ...analysisV2.scoreBlockers.map(({ text }) => text),
        ...analysisV2.careerRisks.map(({ text }) => text)
      ], firstPriority),
      firstPriority: { id: analysisV2.firstPriority.id, text: firstPriority },
      context: {
        targetRole: analysisV2.context.targetRole,
        companyType: analysisV2.context.companyType
      }
    };
  }

  if (!legacyAnalysis) return null;
  return {
    readiness: {
      score: legacyAnalysis.readinessScore,
      label: "Placement readiness",
      summary: "Your current result reflects the profile and preparation information available for this analysis."
    },
    diagnosis: legacyAnalysis.diagnosis,
    strengths: presentStrengths(legacyAnalysis.strengths, legacyAnalysis.strengthFacts)
      .map((text, index) => ({ id: `legacy-strength-${index + 1}`, text })),
    scoreBlockers: legacyAnalysis.weaknesses.map((text, index) => ({ id: `legacy-weakness-${index + 1}`, text })),
    careerRisks: [],
    limitations: selectLimitations(legacyAnalysis.weaknesses, null),
    firstPriority: null,
    context: null
  };
};
