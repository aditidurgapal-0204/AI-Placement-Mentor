export type StrengthFact = {
  type?: string;
  technologies?: string[];
  primaryTechnologies?: string[];
  projectNames?: string[];
  methods?: string[];
  projectCount?: number;
  role?: string;
  team?: string;
  organization?: string;
  exists?: boolean;
};

const joinNaturally = (items: string[]) => {
  const values = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (values.length < 2) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const humanize = (value = "") => value
  .replace(/_/g, " ")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const formatFact = (fact: StrengthFact) => {
  const technologies = joinNaturally((fact.primaryTechnologies || fact.technologies || []).slice(0, 3));
  const methods = joinNaturally((fact.methods || []).slice(0, 3));
  const count = Number.isInteger(fact.projectCount) && (fact.projectCount || 0) > 0
    ? ` across ${fact.projectCount} project${fact.projectCount === 1 ? "" : "s"}`
    : " in projects";

  if (fact.type === "leadership" && fact.role) {
    const context = joinNaturally([fact.team || "", fact.organization || ""]);
    return `Demonstrated leadership as ${fact.role}${context ? ` at ${context}` : ""}.`;
  }

  if (technologies) {
    const category = humanize(fact.type).replace(/\bevidence\b/gi, "").replace(/\s+/g, " ").trim() || "technology";
    return `Demonstrated ${category} using ${technologies}${count}.`;
  }

  if (fact.type === "github_presence" && fact.exists) {
    return "Maintains a GitHub presence that supports review of technical work.";
  }

  if (fact.type) {
    const category = humanize(fact.type).replace(/\bevidence\b/gi, "").replace(/\s+/g, " ").trim();
    return `Demonstrated ${category}${methods ? ` through ${methods}` : count}.`;
  }
  return "";
};

const isRawInternalLabel = (value: string) =>
  /^(?:project\s+)?technology\s*:|^leadership\s+role\s*:|^[a-z]+(?:[A-Z][a-z]+)+\s*:/i.test(value.trim());

const isConciseStrength = (value: string) => {
  const wordCount = value.trim().split(/\s+/).length;
  return wordCount <= 22
    && !/https?:\/\//i.test(value)
    && !/\b(?:19|20)\d{2}\b/.test(value)
    && !/evidence experience/i.test(value);
};

const dedupe = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const presentStrengths = (generated: unknown, facts: unknown): string[] => {
  const generatedStrengths = Array.isArray(generated)
    ? generated.filter((value): value is string => typeof value === "string" && Boolean(value.trim()) && !isRawInternalLabel(value) && isConciseStrength(value))
    : [];

  if (generatedStrengths.length > 0) return dedupe(generatedStrengths.map((value) => value.trim())).slice(0, 6);

  const fallback = Array.isArray(facts)
    ? facts.map((fact) => formatFact(fact as StrengthFact)).filter(Boolean)
    : [];
  return dedupe(fallback).slice(0, 6);
};
