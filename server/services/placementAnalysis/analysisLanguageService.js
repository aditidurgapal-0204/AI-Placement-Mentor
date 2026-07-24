console.log("USING ANALYSIS FILE:", __filename);
const {
  DTO_VERSION,
  validatePresentationSafeGeminiInput
} = require("../../contracts/presentationSafeGemini.v1");

const {
  validateGeminiGrounding
} = require("./geminiGroundingValidator");

const {
  renderDeterministicAnalysis
} = require("./deterministicAnalysisRenderer");

const publicInsight = (insight) => ({
  id: insight.id,

  type: insight.type,

  facts: insight.facts || {},

  ...(insight.scoring
    ? {
        scoring: {
          ...insight.scoring
        }
      }
    : {}),

  ...(typeof insight.affectsCurrentScore === "boolean"
    ? {
        affectsCurrentScore:
          insight.affectsCurrentScore
      }
    : {})
});

/*
 * Security boundary:
 * Only explicitly approved presentation-safe fields are sent to Gemini.
 * Never clone the complete snapshot and attempt to redact it afterward.
 */
const createPresentationSafeGeminiDto = (snapshot) => {
  const strengths = snapshot.strengths.map(publicInsight);
  const scoreBlockers = snapshot.scoreBlockers.map(publicInsight);

  const careerRisks = snapshot.careerRisks.map((risk) => ({
    ...publicInsight(risk),
    affectsCurrentScore: false
  }));

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

  pointsToNextLevel:
    snapshot.readiness.pointsToNextLevel
},

    strengths,

    scoreBlockers,

    careerRisks,

    priority: {
  id: snapshot.priority.id,

  sourceId: snapshot.priority.sourceId,

  sourceType: snapshot.priority.sourceType,

  facts: snapshot.priority.facts,

  expectedImpact:
    snapshot.priority.expectedImpact,

  preparationFeasibility:
    snapshot.priority.preparationFeasibility
},
    /*
     * Diagnosis receives broader evidence than the cards.
     * Gemini still cannot introduce any fact that is absent here.
     */
    diagnosisContext: {
  strongestEvidence: strengths.slice(0, 4),

  scoreCauses: scoreBlockers.slice(0, 4),

  importantCareerRisks: careerRisks.slice(0, 3),

  priority: {
    id: snapshot.priority.id,

    sourceId: snapshot.priority.sourceId,

    sourceType: snapshot.priority.sourceType,

    facts: snapshot.priority.facts,

    expectedImpact:
      snapshot.priority.expectedImpact,

    preparationFeasibility:
      snapshot.priority.preparationFeasibility
  },

  preparationContext: {
    timelineMonths:
      snapshot.context.timelineMonths,

    dailyStudyHours:
      snapshot.context.dailyStudyHours,

    feasibility:
      snapshot.preparation.feasibility,

    improvementPotential:
      snapshot.preparation.improvementPotential
  }
}
  };

  const validation =
    validatePresentationSafeGeminiInput(dto);

  if (!validation.valid) {
    throw new Error(
      `Presentation-safe Gemini DTO is invalid: ${
        validation.errors.join("; ")
      }`
    );
  }

  return dto;
};

const buildLanguagePrompt = (dto) => `
You are the language-rendering layer of an engineering placement analysis system.

The backend has already completed all analysis and decision-making.

It has already determined:

- the readiness score;
- the strengths;
- the score blockers;
- the career risks;
- the first priority;
- the preparation feasibility;
- the supporting facts for every insight.

Your only responsibility is to express the supplied structured facts in clear, natural English.

STRICT GROUNDING RULES

1. Use only information present inside MENTOR_ANALYSIS.
2. Do not perform additional analysis.
3. Do not change the readiness score.
4. Do not create new strengths, blockers, risks or priorities.
5. Do not remove, merge or split supplied insights.
6. Preserve every insight ID exactly.
7. Preserve the supplied order of all collections.
8. Do not invent projects, technologies, achievements, experience, certifications or skill levels.
9. Do not infer that missing evidence proves inability.
10. Career risks must not be presented as causes of the readiness score unless the supplied data explicitly says they affect it.
11. Do not expose internal field names, scoring metadata or backend terminology.
12. Return only valid JSON without markdown or code fences.

DIAGNOSIS

Write one coherent mentor paragraph.

The diagnosis must contain between 3 and 7 complete sentences.

It should naturally explain:

- what the readiness score means for the target role;
- the strongest evidence currently supporting the student;
- the most important factors limiting the current score;
- any important career risk separate from score causality;
- the supplied first priority;
- whether the available preparation capacity makes improvement realistic.

Use only the most relevant supplied facts.

Do not mechanically list every card.

Do not repeat the readiness score more than once.

Do not use headings, bullet points or internal analytical terms inside the diagnosis.

INSIGHT CARDS

Write exactly one complete sentence for every supplied insight.

Each sentence must:

- communicate one clear idea;
- use concrete supplied evidence where available;
- remain concise;
- explain the placement relevance naturally when necessary.

Do not add a second sentence.

Do not combine unrelated weaknesses.

Do not repeat the same generic closing statement across cards.

Use direct and natural English.

OUTPUT STRUCTURE

Return exactly this JSON structure:

{
  "analysisId": "${dto.analysisId}",
  "diagnosis": "One coherent paragraph.",
  "strengths": [
    {
      "insightId": "exact supplied strength id",
      "text": "exactly one sentence"
    }
  ],
  "scoreBlockers": [
    {
      "insightId": "exact supplied score blocker id",
      "text": "exactly one sentence"
    }
  ],
  "careerRisks": [
    {
      "insightId": "exact supplied career risk id",
      "text": "exactly one sentence"
    }
  ],
  "priority": {
    "insightId": "${dto.priority.id}",
    "text": "exactly one sentence"
  }
}

The number of output entries must exactly match the corresponding input collections.

MENTOR_ANALYSIS

${JSON.stringify(dto, null, 2)}
`.trim();

const parseGeneratedOutput = (value) => {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError(
      "Language generator must return JSON text or an object."
    );
  }

  const cleaned = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(cleaned);
};

const withTimeout = (promise, timeoutMs) => {
  if (
    !Number.isFinite(timeoutMs)
    || timeoutMs <= 0
  ) {
    return promise;
  }

  let timeout;

  return Promise.race([
    promise,

    new Promise((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Gemini language generation timed out."
            )
          ),
        timeoutMs
      );
    })
  ]).finally(() => clearTimeout(timeout));
};

const groundingFailureCategory = (errors) => {
  const message = (errors || [])
    .join(" ")
    .toLowerCase();

  if (message.includes("timed out")) {
    return "timeout";
  }

  if (
    message.includes("json")
    || message.includes("unexpected token")
  ) {
    return "malformed_output";
  }

  if (
    message.includes("insight id")
    || message.includes("ordering")
  ) {
    return "insight_identity";
  }

  if (message.includes("numeric claim")) {
    return "unsupported_numeric_claim";
  }

  if (message.includes("score causality")) {
    return "causality_violation";
  }

  if (
    message.includes("required")
    || message.includes("must")
  ) {
    return "schema_validation";
  }

  return "generator_unavailable";
};

const generateAnalysisLanguage = async (
  snapshot,
  generate,
  options = {}
) => {
  const dto =
    createPresentationSafeGeminiDto(snapshot);

    console.log("\n========== GEMINI DTO ==========");
    console.dir(dto, { depth: null });

  const fallback = () => ({
    source: "deterministic_fallback",
    dto,
    output: renderDeterministicAnalysis(dto)
  });

  if (typeof generate !== "function") {
    return fallback();
  }

  try {
    const generated = generate({
      prompt: buildLanguagePrompt(dto),
      dto
    });

    const generatedValue = await withTimeout(
      Promise.resolve(generated),
      options.timeoutMs
    );
    
    console.log("\n========== RAW GEMINI ==========");
console.log(generatedValue);

    const output =
      parseGeneratedOutput(generatedValue);

    const grounding =
      validateGeminiGrounding(output, dto);

    if (!grounding.valid) {
      return {
        ...fallback(),

        groundingErrors: grounding.errors,

        failureCategory:
          groundingFailureCategory(
            grounding.errors
          )
      };
    }

  console.log("\n========== FINAL OUTPUT ==========");
console.dir(output, { depth: null });
  
    return {
      source: "gemini",
      dto,
      output
    };
  } catch (error) {
    const groundingErrors = [
      error.message
    ];

    return {
      ...fallback(),

      groundingErrors,

      failureCategory:
        groundingFailureCategory(
          groundingErrors
        )
    };
  }
};

module.exports = {
  createPresentationSafeGeminiDto,
  buildLanguagePrompt,
  groundingFailureCategory,
  generateAnalysisLanguage
};