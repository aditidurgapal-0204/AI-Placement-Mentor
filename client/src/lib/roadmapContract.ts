export interface RoadmapMonth {
  month: number;
  title: string;
  focus: string;
  topics: string[];
  goals: string[];
}

export interface PlacementRoadmap {
  contractVersion: "1.0";
  durationMonths: number;
  targetRole: string;
  source: "gemini" | "deterministic_fallback";
  roadmap: RoadmapMonth[];
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length >= 2 && value.length <= 8 && value.every((item) => typeof item === "string" && item.trim().length > 0);

export const parsePlacementRoadmap = (value: unknown): PlacementRoadmap | null => {
  if (!object(value) || value.contractVersion !== "1.0" || !Number.isInteger(value.durationMonths)
    || Number(value.durationMonths) < 1 || Number(value.durationMonths) > 24 || typeof value.targetRole !== "string"
    || !["gemini", "deterministic_fallback"].includes(String(value.source)) || !Array.isArray(value.roadmap)
    || value.roadmap.length !== value.durationMonths) return null;
  const roadmap = value.roadmap.map((month, index) => {
    if (!object(month) || month.month !== index + 1 || typeof month.title !== "string" || !month.title.trim()
      || typeof month.focus !== "string" || !month.focus.trim() || !strings(month.topics) || !strings(month.goals)) return null;
    return { month: index + 1, title: month.title.trim(), focus: month.focus.trim(), topics: [...month.topics], goals: [...month.goals] };
  });
  if (roadmap.some((month) => month === null)) return null;
  return {
    contractVersion: "1.0", durationMonths: Number(value.durationMonths), targetRole: value.targetRole.trim(),
    source: value.source as PlacementRoadmap["source"], roadmap: roadmap as RoadmapMonth[]
  };
};
