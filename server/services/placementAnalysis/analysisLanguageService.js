const {
  DTO_VERSION,
  validatePresentationSafeGeminiInput
} = require("../../contracts/presentationSafeGemini.v1");
const { validateGeminiGrounding } = require("./geminiGroundingValidator");
const { renderDeterministicAnalysis } = require("./deterministicAnalysisRenderer");

const publicInsight = (insight) => ({
  id: insight.id,
  conclusion: insight.conclusion,
  studentMeaning: insight.studentMeaning,
  roleConnection: insight.roleConnection
});

// Security boundary: intentionally assemble approved fields. Never clone and redact a snapshot.
const createPresentationSafeGeminiDto = (snapshot) => {
  const dto = {
    version: DTO_VERSION,
    analysisId: snapshot.metadata.id,
    context: {
      targetRole: snapshot.context.targetRole,
      companyType: snapshot.context.companyType,
      timelineMonths: snapshot.context.timelineMonths,
      dailyStudyHours: snapshot.context.dailyStudyHours,
      resumeProvided: snapshot.context.resumeProvided
    },
    readiness: {
      score: snapshot.readiness.score,
      labelKey: snapshot.readiness.labelKey,
      nextLabelKey: snapshot.readiness.nextLabelKey,
      meaning: snapshot.readiness.explanation
    },
    strengths: snapshot.strengths.map(publicInsight),
    scoreBlockers: snapshot.scoreBlockers.map(publicInsight),
    careerRisks: snapshot.careerRisks.map((risk) => ({
      id: risk.id,
      conclusion: risk.conclusion,
      studentMeaning: risk.studentMeaning,
      roleConnection: risk.roleConnection,
      affectsCurrentScore: false
    })),
    priority: {
      id: snapshot.priority.id,
      objective: snapshot.priority.objective,
      whyFirst: snapshot.priority.whyFirst
    }
  };
  const validation = validatePresentationSafeGeminiInput(dto);
  if (!validation.valid) throw new Error(`Presentation-safe Gemini DTO is invalid: ${validation.errors.join("; ")}`);
  return dto;
};

const buildLanguagePrompt = (dto) => `You are the voice of an experienced placement mentor speaking directly to an engineering student.

The backend has already selected every conclusion, action, priority, and classification. Rewrite only the supplied meaning in simple, natural English. Do not add facts, technologies, achievements, projects, metrics, actions, or recommendations. Do not remove, merge, split, reorder, or reprioritize insights. Preserve every insight ID exactly. Career risks do not affect the current readiness score.

Language requirements:
- Address the student as "you" and mention the target role where it is relevant.
- Make each strength explain what is strong, what part of the profile supports it, and why it matters.
- Make each blocker or risk explain the gap, why it matters, and the supplied next action.
- Keep the diagnosis to 3–5 complete sentences and roughly 55–110 words.
- In the diagnosis, explain the current position, strongest advantage, biggest limitation, and direction of improvement without copying list items word for word.
- Keep each list item readable and focused on one idea.
- Avoid repeated conclusions across sections.
- Never use internal analytics vocabulary such as "verified evidence", "meaningful placement strength", "preparation runway", "professional-context evidence", "assessed foundations", "employability consideration", "score contribution", "capability family", "reasoning dimension", or "confidence aggregation".
- Return only JSON matching the supplied collections and IDs.

MENTOR_ANALYSIS
${JSON.stringify(dto, null, 2)}`;

const parseGeneratedOutput = (value) => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new TypeError("Language generator must return JSON text or an object.");
  return JSON.parse(value);
};

const withTimeout = (promise, timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Gemini language generation timed out.")), timeoutMs);
    })
  ]).finally(() => clearTimeout(timeout));
};

const groundingFailureCategory = (errors) => {
  const message = (errors || []).join(" ").toLowerCase();
  if (message.includes("timed out")) return "timeout";
  if (message.includes("json") || message.includes("unexpected token")) return "malformed_output";
  if (message.includes("insight id") || message.includes("ordering")) return "insight_identity";
  if (message.includes("numeric claim")) return "unsupported_numeric_claim";
  if (message.includes("score causality")) return "causality_violation";
  if (message.includes("required") || message.includes("must")) return "schema_validation";
  return "generator_unavailable";
};

const generateAnalysisLanguage = async (snapshot, generate, options = {}) => {
  const dto = createPresentationSafeGeminiDto(snapshot);
  const fallback = () => ({ source: "deterministic_fallback", dto, output: renderDeterministicAnalysis(dto) });
  if (typeof generate !== "function") return fallback();

  try {
    const generated = generate({ prompt: buildLanguagePrompt(dto), dto });
    const output = parseGeneratedOutput(await withTimeout(Promise.resolve(generated), options.timeoutMs));
    const grounding = validateGeminiGrounding(output, dto);
    if (!grounding.valid) return {
      ...fallback(), groundingErrors: grounding.errors,
      failureCategory: groundingFailureCategory(grounding.errors)
    };
    return { source: "gemini", dto, output };
  } catch (error) {
    const groundingErrors = [error.message];
    return { ...fallback(), groundingErrors, failureCategory: groundingFailureCategory(groundingErrors) };
  }
};

module.exports = {
  createPresentationSafeGeminiDto,
  buildLanguagePrompt,
  groundingFailureCategory,
  generateAnalysisLanguage
};
