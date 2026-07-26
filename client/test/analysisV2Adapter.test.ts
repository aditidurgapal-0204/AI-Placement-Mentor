import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { adaptAnalysisResponse, FatalAnalysisResponseError } from "../src/lib/analysisResponseAdapter";
import { AnalysisV2ValidationError, parseAnalysisV2 } from "../src/lib/analysisV2Contract";
import { selectDashboardAnalysis } from "../src/lib/dashboardAnalysisCompatibility";
import {
  acceptAnalysisState, beginAnalysisState, failAnalysisState,
  initialAnalysisState, migrateAnalysisPersistedState
} from "../src/store/analysisStoreModel";

const legacy = () => ({
  readinessScore: 49, diagnosis: "A valid legacy diagnosis.", strengths: ["Legacy strength"],
  weaknesses: ["Legacy weakness"], strengthFacts: [{ type: "capability" }]
});
const insight = (id: string) => ({ id, text: `Language for ${id}.` });
const v2 = () => ({
  analysisId: "analysis-v2", requestId: "backend-request-v2", createdAt: "2026-07-20T00:00:00.000Z",
  contractVersion: "2.0", languageSource: "gemini",
  readiness: {
    score: 49, label: "Developing", labelKey: "developing",
    nextLevel: { label: "Progressing", labelKey: "progressing", pointsRequired: 1 },
    explanation: "Verified factors explain the current result."
  },
  diagnosis: "A grounded mentor diagnosis.", strengths: [insight("strength-1"), insight("strength-2")],
  scoreBlockers: [insight("blocker-1")], careerRisks: [insight("risk-1")],
  firstPriority: { id: "priority-1", text: "Improve the selected priority.", preparationFeasibility: "strong" },
  preparation: { feasibility: "strong", improvementPotential: "strong_capacity_for_focused_improvement" },
  context: { targetRole: "Backend Developer", companyType: "Product Based", timelineMonths: 6, dailyStudyHours: 5, resumeProvided: true }
});
const envelope = (analysisV2: unknown = v2(), analysis: unknown = legacy()) => ({
  success: true, analysis, analysisV2,
  profileData: { id: "profile-1", branch: "CSE", resumeText: "private resume", resumeAvailable: true }
});

test("valid analysisV2 is parsed into a new normalized object with ordering preserved", () => {
  const input = v2();
  const parsed = parseAnalysisV2(input);
  assert.notEqual(parsed, input);
  assert.deepEqual(parsed.strengths.map(({ id }) => id), ["strength-1", "strength-2"]);
});

test("valid legacy and V2 are stored separately", () => {
  const adapted = adaptAnalysisResponse(envelope());
  const accepted = acceptAnalysisState(beginAnalysisState(initialAnalysisState(), "client-1"), "client-1", adapted);
  assert.equal(accepted.activeAnalysisVersion, "v2");
  assert.equal(accepted.analysis?.readinessScore, 49);
  assert.equal(accepted.legacyAnalysis?.readinessScore, 49);
  assert.equal(accepted.analysisV2?.analysisId, "analysis-v2");
  assert.notEqual(accepted.analysis, adapted.legacyAnalysis);
  assert.equal(JSON.stringify(accepted.profileData).includes("resumeText"), false);
});

test("missing analysisV2 preserves legacy behavior", () => {
  const adapted = adaptAnalysisResponse(envelope(null));
  assert.equal(adapted.v2ValidationStatus, "unavailable");
  const accepted = acceptAnalysisState(beginAnalysisState(initialAnalysisState(), "client-1"), "client-1", adapted);
  assert.equal(accepted.activeAnalysisVersion, "legacy");
  assert.equal(accepted.analysis?.diagnosis, legacy().diagnosis);
});

test("invalid analysisV2 preserves valid legacy success with safe validation state", () => {
  const adapted = adaptAnalysisResponse(envelope({ contractVersion: "2.0" }));
  assert.equal(adapted.v2ValidationStatus, "invalid");
  const accepted = acceptAnalysisState(beginAnalysisState(initialAnalysisState(), "client-1"), "client-1", adapted);
  assert.equal(accepted.analysisStatus, "success");
  assert.equal(accepted.activeAnalysisVersion, "legacy");
  assert.ok(accepted.analysisError?.includes("legacy analysis"));
});

test("invalid legacy and invalid V2 follows fatal response behavior", () => {
  assert.throws(() => adaptAnalysisResponse(envelope({ contractVersion: "bad" }, {})), FatalAnalysisResponseError);
});

test("unknown contract version is rejected", () => {
  assert.throws(() => parseAnalysisV2({ ...v2(), contractVersion: "3.0" }), AnalysisV2ValidationError);
});

test("invalid language source is rejected", () => {
  assert.throws(() => parseAnalysisV2({ ...v2(), languageSource: "unknown" }), AnalysisV2ValidationError);
});

test("invalid readiness score and label structure are rejected", () => {
  assert.throws(() => parseAnalysisV2({ ...v2(), readiness: { ...v2().readiness, score: 101 } }), AnalysisV2ValidationError);
  assert.throws(() => parseAnalysisV2({ ...v2(), readiness: { ...v2().readiness, label: "" } }), AnalysisV2ValidationError);
});

test("duplicate insight IDs are rejected", () => {
  const input = v2();
  input.strengths.push(insight("strength-1"));
  assert.throws(() => parseAnalysisV2(input), AnalysisV2ValidationError);
});

test("invalid blocker or career-risk structures are rejected", () => {
  assert.throws(() => parseAnalysisV2({ ...v2(), scoreBlockers: [{ id: "blocker" }] }), AnalysisV2ValidationError);
  assert.throws(() => parseAnalysisV2({ ...v2(), careerRisks: "risk" }), AnalysisV2ValidationError);
});

test("forbidden server-internal fields cannot enter client state", () => {
  for (const field of ["internalTrace", "canonicalEvidence", "contributionIds", "scoreEffect", "groundingErrors", "prompt"]) {
    assert.throws(() => parseAnalysisV2({ ...v2(), [field]: "private" }), AnalysisV2ValidationError, field);
  }
});

test("adapter does not mutate or retain mutable API input references", () => {
  const input = envelope();
  const before = structuredClone(input);
  const adapted = adaptAnalysisResponse(input);
  adapted.legacyAnalysis.strengths.push("Client-only mutation");
  assert.deepEqual(input, before);
  assert.equal((input.analysis as ReturnType<typeof legacy>).strengths.includes("Client-only mutation"), false);
});

test("older response completing later is ignored", () => {
  let state = beginAnalysisState(initialAnalysisState(), "older");
  state = beginAnalysisState(state, "newer");
  const stale = acceptAnalysisState(state, "older", adaptAnalysisResponse(envelope()));
  assert.equal(stale, state);
});

test("older success cannot replace newer success", () => {
  let state = beginAnalysisState(initialAnalysisState(), "newer");
  state = acceptAnalysisState(state, "newer", adaptAnalysisResponse(envelope()));
  assert.equal(acceptAnalysisState(state, "older", adaptAnalysisResponse(envelope())).latestAcceptedRequestId, "backend-request-v2");
});

test("older failure cannot replace newer success", () => {
  let state = beginAnalysisState(initialAnalysisState(), "newer");
  state = acceptAnalysisState(state, "newer", adaptAnalysisResponse(envelope()));
  assert.equal(failAnalysisState(state, "older"), state);
});

test("newer failure is not replaced by older success", () => {
  let state = beginAnalysisState(initialAnalysisState(), "newer");
  state = failAnalysisState(state, "newer");
  assert.equal(acceptAnalysisState(state, "older", adaptAnalysisResponse(envelope())), state);
  assert.equal(state.analysisStatus, "error");
});

test("concurrent request identities remain deterministic", () => {
  const older = beginAnalysisState(initialAnalysisState(), "older");
  const newer = beginAnalysisState(older, "newer");
  assert.equal(acceptAnalysisState(newer, "older", adaptAnalysisResponse(envelope())), newer);
  assert.equal(acceptAnalysisState(newer, "newer", adaptAnalysisResponse(envelope())).latestAcceptedRequestId, "backend-request-v2");
});

for (const source of ["deterministic_fallback", "gemini"] as const) {
  test(`${source} V2 is treated as successful`, () => {
    const adapted = adaptAnalysisResponse(envelope({ ...v2(), languageSource: source }));
    const state = acceptAnalysisState(beginAnalysisState(initialAnalysisState(), "client"), "client", adapted);
    assert.equal(state.analysisStatus, "success");
    assert.equal(state.analysisV2?.languageSource, source);
  });
}

test("persisted legacy state migrates without loss and remains dashboard-readable", () => {
  const migrated = migrateAnalysisPersistedState({ analysis: legacy(), profileData: { id: "profile-old", branch: "CSE", resumeText: "old private resume" }, activeRequestId: "obsolete" });
  assert.deepEqual(migrated.analysis, legacy());
  assert.deepEqual(migrated.legacyAnalysis, legacy());
  assert.equal((migrated.profileData as { branch?: string }).branch, "CSE");
  assert.equal(JSON.stringify(migrated.profileData).includes("resumeText"), false);
  assert.equal(migrated.latestRequestedRequestId, null);
});

test("corrupted persisted V2 is discarded safely without erasing legacy state", () => {
  const migrated = migrateAnalysisPersistedState({ analysis: legacy(), analysisV2: { contractVersion: "broken" } });
  assert.equal(migrated.analysisV2, null);
  assert.equal(migrated.v2ValidationStatus, "invalid");
  assert.equal(migrated.analysis?.readinessScore, 49);
});

test("dashboard compatibility prefers V2 language without exposing insight IDs", () => {
  const source = parseAnalysisV2(v2());
  const dashboard = selectDashboardAnalysis(legacy(), source);
  assert.equal(dashboard?.readiness.score, source.readiness.score);
  assert.equal(dashboard?.readiness.summary, source.readiness.explanation);
  assert.equal(dashboard?.diagnosis, source.diagnosis);
  assert.deepEqual(dashboard?.strengths, source.strengths.map(({ id, text }) => ({ id, text })));
  assert.deepEqual(dashboard?.scoreBlockers, source.scoreBlockers.map(({ id, text }) => ({ id, text })));
  assert.deepEqual(dashboard?.careerRisks, source.careerRisks.map(({ id, text }) => ({ id, text })));
  assert.deepEqual(dashboard?.firstPriority, { id: source.firstPriority.id, text: source.firstPriority.text });
  assert.ok(dashboard?.limitations.includes(source.scoreBlockers[0].text));
  assert.ok(dashboard?.limitations.includes(source.careerRisks[0].text));
  assert.equal(dashboard?.limitations.some((text) => /^first priority:/i.test(text)), false);
  assert.deepEqual(Object.keys(dashboard || {}).sort(), ["careerRisks", "context", "diagnosis", "firstPriority", "limitations", "readiness", "scoreBlockers", "strengths"]);
});

test("dashboard compatibility preserves legacy analysis when V2 is unavailable", () => {
  const source = legacy();
  const dashboard = selectDashboardAnalysis(source, null);
  assert.equal(dashboard?.readiness.score, source.readinessScore);
  assert.deepEqual(dashboard?.strengths, source.strengths.map((text, index) => ({ id: `legacy-strength-${index + 1}`, text })));
  assert.deepEqual(dashboard?.scoreBlockers, source.weaknesses.map((text, index) => ({ id: `legacy-weakness-${index + 1}`, text })));
  assert.deepEqual(dashboard?.careerRisks, []);
  assert.deepEqual(dashboard?.limitations, source.weaknesses);
  assert.equal(dashboard?.firstPriority, null);
});

test("dashboard compatibility removes duplicate public limitations without mutating V2", () => {
  const source = parseAnalysisV2(v2());
  source.careerRisks[0].text = source.scoreBlockers[0].text;
  const before = structuredClone(source);
  const dashboard = selectDashboardAnalysis(legacy(), source);
  assert.equal(dashboard?.limitations.filter((text) => text === source.scoreBlockers[0].text).length, 1);
  assert.deepEqual(source, before);
});

test("dashboard presentation keeps First Priority distinct and limits semantic limitations to three", () => {
  const source = parseAnalysisV2({
    ...v2(),
    firstPriority: { ...v2().firstPriority, text: "Complete three focused DSA sessions and one core-subject review every week." },
    scoreBlockers: [
      { id: "blocker-1", text: "Core interview preparation needs more consistency. Complete three DSA sessions every week." },
      { id: "blocker-2", text: "Your project work needs stronger testing and deployment. Improve one project with both." }
    ],
    careerRisks: [
      { id: "risk-1", text: "Weak preparation depth may affect interviews. Complete regular DSA sessions every week." },
      { id: "risk-2", text: "Recruiters need clearer proof of teamwork. Complete one team engineering contribution." },
      { id: "risk-3", text: "Your portfolio is difficult to review. Publish one project with a clear README." }
    ]
  });
  const dashboard = selectDashboardAnalysis(legacy(), source);
  assert.deepEqual(dashboard?.firstPriority, { id: source.firstPriority.id, text: source.firstPriority.text });
  assert.ok((dashboard?.limitations.length || 0) <= 3);
  assert.equal(dashboard?.limitations.some((text) => text === source.firstPriority.text), false);
  assert.equal(dashboard?.limitations.some((text) => /DSA sessions every week/i.test(text)), false);
});

test("representative public V2 strengths survive client validation and dashboard presentation", () => {
  const texts = [
    "Your projects show that you can work across the frontend, backend, and database, which is valuable for Full-Stack Engineer roles.",
    "Your interface work shows that you can build responsive experiences for users, which supports frontend responsibilities in the target role.",
    "Your deployed portfolio shows that you can finish and publish working software, making your work easier for recruiters to review.",
    "Your navigation project demonstrates practical problem-solving by applying routing concepts to a clear user need.",
    "Your coordination and public-speaking experience show leadership and communication beyond individual technical work."
  ];
  const source = parseAnalysisV2({ ...v2(), strengths: texts.map((text, index) => ({ id: `strength-${index + 1}`, text })) });
  const dashboard = selectDashboardAnalysis(legacy(), source);
  assert.deepEqual(dashboard?.strengths, texts.map((text, index) => ({ id: `strength-${index + 1}`, text })));
  assert.equal(dashboard?.strengths.length, 5);
});

test("restored dashboard visual structure remains unchanged", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
  for (const marker of [
    "Placement Insights", "AI Diagnosis", "First Priority", "Score Blockers", "Career Risks", "Your Strengths",
    "Placement Action Plan", "lg:grid-cols-2", "h-28 w-28", "bg-[#090514]"
  ]) assert.ok(page.includes(marker), marker);
  assert.equal(page.includes("ReadinessOverview"), false);
  assert.equal(page.includes("InsightListSection"), false);
  assert.ok(page.includes("displayedStrengths.length > 0"));
});
