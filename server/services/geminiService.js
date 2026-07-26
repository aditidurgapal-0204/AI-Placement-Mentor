/**
 * server/services/geminiService.js
 * EXPLANATION CORE LAYER - GEMINI 2.5 FLASH CONTEXT INTERACTION
 * Synchronized with the frozen, refactored computeReadiness() multi-array API.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { computeReadiness } = require("./readinessEngine");

const humanize = (value) => String(value || "current capability")
  .replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const describeStrengthFact = (fact) => {
  const focus = humanize(fact.focus || fact.type);
  if (fact.type === "demonstratedTechnicalCapability") return `Your projects show practical ${focus} skills that support your target engineering role.`;
  if (fact.type === "academicConsistency") return "Your academic record shows consistency, which supports steady technical learning and preparation.";
  if (fact.type === "preparationCapacity") return "Your available preparation time gives you a useful opportunity to improve through regular weekly work.";
  if (fact.type === "professionalEvidence") return "Your profile includes experience beyond coursework, which helps recruiters understand your responsibility and initiative.";
  return "Your current interview preparation gives you a useful base to build on for placement rounds.";
};

const describeWeaknessFact = (fact, targetRole) => {
  const messages = {
    corePreparationDepth: `Some core interview subjects need more practice for ${targetRole} screening. Build a regular DSA and core-subject revision routine.`,
    preparationRunway: "Your preparation time is limited. Use one weekly plan and work on the highest-impact interview and project tasks first.",
    targetRoleAlignment: `Your current preparation does not yet match the expectations for ${targetRole} at the selected company type. Focus first on the required interview foundations.`,
    professionalExposure: "Your profile does not yet show enough real-world engineering experience. Gain one experience through an internship, open-source contribution, freelance task, or team project.",
    productionReadiness: "Your projects need stronger proof of production-quality work. Improve one project with deployment, testing, documentation, and a complete working outcome.",
    portfolioVerifiability: "Recruiters may find it difficult to review your work. Publish your strongest project in a clear portfolio and explain what you personally built.",
    demonstratedTechnicalDepth: `Your profile needs one stronger project for ${targetRole} applications. Complete a focused project that clearly shows implementation depth and technical ownership.`,
    resumeEvidenceDepth: "Your resume needs clearer proof of your technical work. Rewrite the strongest entries around your responsibility, implementation, and outcome."
  };
  return messages[fact.type] || `Strengthen the most important gap in your ${targetRole} preparation and track one clear outcome each week.`;
};

const toFallbackDashboardEvidence = (engineFacts, targetRole) => ({
  strengths: (engineFacts.strengthFacts || []).map(describeStrengthFact).slice(0, 6),
  weaknesses: (engineFacts.weaknessFacts || []).map((fact) => describeWeaknessFact(fact, targetRole)).slice(0, 6)
});

const fallbackDiagnosis = (engineFacts, evidence, profileData) => {
  const strength = evidence.strengths[0] || "There is not enough verified evidence yet to highlight a clear strength confidently.";
  const weakness = evidence.weaknesses[0] || "Your next step is to build clearer proof of role-relevant preparation.";
  const basis = engineFacts.extractedMetrics.resumeEvaluated
    ? "your onboarding profile and uploaded resume"
    : "your onboarding profile because no resume was included";
  return `Your readiness for ${profileData.targetRole} is based on ${basis}. ${strength} ${weakness} Work on that priority first while continuing the preparation that is already helping your profile.`;
};

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing from configuration.");
  return new GoogleGenerativeAI(apiKey);
};

const MIN_DIAGNOSIS_WORDS = 45;
const MAX_DIAGNOSIS_WORDS = 120;
const MAX_GEMINI_ATTEMPTS = 2;

const validateDiagnosis = (value) => {
  if (typeof value !== "string") return null;

  const diagnosis = value.trim();
  const wordCount = diagnosis ? diagnosis.split(/\s+/).length : 0;
  const sentenceCount = (diagnosis.match(/[.!?](?:\s|$)/g) || []).length;

  return !diagnosis.startsWith("{")
    && !diagnosis.startsWith("```")
    && wordCount >= MIN_DIAGNOSIS_WORDS
    && wordCount <= MAX_DIAGNOSIS_WORDS
    && sentenceCount >= 3
    && sentenceCount <= 5
    ? diagnosis
    : null;
};

const normalizeStrength = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const validateGeneratedItems = (value) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value.filter((strength) => {
    if (typeof strength !== "string" || !strength.trim()) return false;
    if (/^(?:project\s+)?technology\s*:|^leadership\s+role\s*:|^[a-z]+(?:[A-Z][a-z]+)+\s*:/i.test(strength.trim())) return false;
    if (/verified evidence|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration/i.test(strength)) return false;
    if (strength.trim().split(/\s+/).length > 22) return false;
    if (/https?:\/\/|\b(?:19|20)\d{2}\b|evidence experience/i.test(strength)) return false;

    const normalized = normalizeStrength(strength);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).map((strength) => strength.trim()).slice(0, 6);
};

const parseGeminiAnalysis = (value) => {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    const diagnosis = validateDiagnosis(parsed.diagnosis);
    if (!diagnosis || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.weaknesses)) return null;
    return {
      diagnosis,
      strengths: validateGeneratedItems(parsed.strengths),
      weaknesses: validateGeneratedItems(parsed.weaknesses)
    };
  } catch {
    return null;
  }
};

const compactProjectLabel = (value) => String(value || "")
  .replace(/https?:\/\/\S+/gi, "")
  .replace(/\([^)]*\b(?:19|20)\d{2}\b[^)]*\)/g, "")
  .replace(/\s+[|–—-]\s*(?:\b(?:19|20)\d{2}\b|$).*$/g, "")
  .replace(/\s+/g, " ")
  .trim();

const compactTopFact = (fact) => fact ? {
  category: fact.category,
  projectCount: fact.projectCount,
  primaryTechnologies: (fact.technologies || fact.primaryTechnologies || []).slice(0, 3),
  methods: (fact.methods || []).slice(0, 3)
} : null;

const compactTopEvidence = (topEvidence) => topEvidence ? {
  strongestProject: topEvidence.strongestProject ? {
    name: compactProjectLabel(topEvidence.strongestProject.name),
    type: topEvidence.strongestProject.type,
    reasons: topEvidence.strongestProject.reasons,
    roleRelevance: topEvidence.strongestProject.roleRelevance
  } : null,
  strongestTechnicalEvidence: compactTopFact(topEvidence.strongestTechnicalEvidence),
  strongestLeadership: topEvidence.strongestLeadership,
  strongestDeployment: compactTopFact(topEvidence.strongestDeployment),
  strongestMachineLearning: compactTopFact(topEvidence.strongestMachineLearning),
  strongestBackend: compactTopFact(topEvidence.strongestBackend),
  strongestFrontend: compactTopFact(topEvidence.strongestFrontend),
  strongestDatabase: compactTopFact(topEvidence.strongestDatabase)
} : null;

const testConnection = async () => {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const result = await model.generateContent("Hello");

  console.log(result.response.usageMetadata);
  console.log(result.response.text());

  return result.response.text();
};

const generatePresentationLanguage = async (prompt, { requestId = "untracked", analysisId = "untracked" } = {}) => {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1800,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          analysisId: { type: "string" },
          diagnosis: { type: "string" },
          strengths: { type: "array", items: { type: "object", properties: { insightId: { type: "string" }, text: { type: "string" } }, required: ["insightId", "text"] } },
          scoreBlockers: { type: "array", items: { type: "object", properties: { insightId: { type: "string" }, text: { type: "string" } }, required: ["insightId", "text"] } },
          careerRisks: { type: "array", items: { type: "object", properties: { insightId: { type: "string" }, text: { type: "string" } }, required: ["insightId", "text"] } },
          priority: { type: "object", properties: { insightId: { type: "string" }, text: { type: "string" } }, required: ["insightId", "text"] }
        },
        required: ["analysisId", "diagnosis", "strengths", "scoreBlockers", "careerRisks", "priority"]
      },
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const response = await result.response;
  const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
  console.info("Gemini mentor language metadata", {
    requestId, analysisId, finishReason,
    promptTokenCount: response.usageMetadata?.promptTokenCount,
    candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
    totalTokenCount: response.usageMetadata?.totalTokenCount
  });
  if (finishReason !== "STOP") throw new Error(`Gemini mentor language ended with finish reason ${finishReason}.`);
  return response.text();
};

const analyzePlacementProfile = async (profileData, { requestId = "untracked", engineFacts: suppliedEngineFacts } = {}) => {
  // Scores and dashboard evidence are generated by backend rules, never by the model.
const engineFacts = suppliedEngineFacts || computeReadiness(profileData);
const fallbackDashboardEvidence = toFallbackDashboardEvidence(engineFacts, profileData.targetRole);

const mentorFacts = {
  readinessScore: engineFacts.readinessScore,
  studentContext: {
    targetRole: profileData.targetRole,
    companyType: profileData.companyType,
    timelineMonths: engineFacts.extractedMetrics.timelineMonths,
    dailyStudyHours: engineFacts.extractedMetrics.dailyStudyHours,
    resumeProvided: engineFacts.extractedMetrics.resumeEvaluated
  },
  scoreExplanation: engineFacts.scoreExplanation,
  strengths: engineFacts.strengthFacts,
  weaknesses: engineFacts.weaknessFacts
};

const prompt = `
You are an experienced Placement Mentor.

The backend has already evaluated the student.

Everything inside FACTS is VERIFIED.

Never calculate scores.

Never invent facts.

Never contradict the supplied facts.

Convert the supplied facts into natural mentor language.

Speak directly to the student using simple, natural English.

The diagnosis should answer:

• Why is the readiness score what it is?

• What has the student already done well?

• What is currently limiting placement readiness?

• What should the student focus on next?

• Why will that improvement matter?

The supplied strengths and weaknesses are already selected, grouped and ordered by the backend. Do not reprioritize, split, merge, add or remove them.

Return one JSON object with exactly these fields:

- "diagnosis": the diagnosis text
- "strengths": an array of 0 to 6 concise, recruiter-friendly strength statements derived only from FACTS.strengths
- "weaknesses": an array of 3 to 6 constructive, role-relevant mentor statements derived only from FACTS.weaknesses

For strengths, express each supplied mentor insight as one capability observation. If FACTS.strengths is empty, return an empty strengths array.

Each strength must be one short sentence of approximately 8 to 18 words. Never include URLs, dates, project headings, raw evidence or descriptions.

Each weakness must explain a meaningful improvement priority without exposing internal labels or sounding punitive. Do not invent missing evidence.

The diagnosis must:

- Explain why the student received this readiness score.
- Explain what the student has already done well.
- Explain what is currently limiting placement readiness.
- Explain what the student should focus on next.
- Use 3 to 5 complete sentences and be between 45 and 120 words.
- Do NOT repeat the readiness score.
- Clearly state the strongest advantage, biggest limitation, and most important direction for improvement.
- Avoid repeating list items word for word.
- Never expose internal terms such as verified evidence, meaningful placement strength, preparation runway, professional-context evidence, assessed foundations, employability consideration, score contribution, capability family, or confidence aggregation.

FACTS

${JSON.stringify(mentorFacts, null, 2)}

`.trim();

let rawResponseText = null;

try {
    const model = getGeminiClient().getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0,
    maxOutputTokens: 1500,
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        diagnosis: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } }
      },
      required: ["diagnosis", "strengths", "weaknesses"]
    },
    thinkingConfig: {
      thinkingBudget: 0
    }
  }
});
    for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
      const result = await model.generateContent({
        contents: [
        {
            role: "user",
            parts: [{ text: prompt }]
        }
        ]
      });
      const response = await result.response;
      const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";

      console.info("Gemini diagnosis response metadata", {
        requestId,
        attempt,
        finishReason,
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
        thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount,
        totalTokenCount: response.usageMetadata?.totalTokenCount
      });

      if (finishReason === "MAX_TOKENS") {
        if (attempt < MAX_GEMINI_ATTEMPTS) continue;
        throw new Error("Gemini diagnosis reached the output token limit.");
      }

      if (finishReason !== "STOP") {
        throw new Error(`Gemini diagnosis ended with finish reason ${finishReason}.`);
      }

      rawResponseText = response.text();
      const generatedAnalysis = parseGeminiAnalysis(rawResponseText);
      if (!generatedAnalysis) {
        throw new Error("Gemini returned an invalid analysis response.");
      }

      return {
        readinessScore: engineFacts.readinessScore,
        diagnosis: generatedAnalysis.diagnosis,
        strengths: generatedAnalysis.strengths.length ? generatedAnalysis.strengths : fallbackDashboardEvidence.strengths,
        strengthFacts: engineFacts.strengthFacts,
        weaknesses: generatedAnalysis.weaknesses.length ? generatedAnalysis.weaknesses : fallbackDashboardEvidence.weaknesses
      };
    }
}
catch (error) {
    console.error("Gemini analysis failed; using deterministic diagnosis.", {
      requestId,
      message: error.message,
      responseCharacterCount: rawResponseText?.length || 0
    });
    return {
      readinessScore: engineFacts.readinessScore,
      diagnosis: fallbackDiagnosis(engineFacts, fallbackDashboardEvidence, profileData),
      strengths: fallbackDashboardEvidence.strengths,
      strengthFacts: engineFacts.strengthFacts,
      weaknesses: fallbackDashboardEvidence.weaknesses
    };
}
};

module.exports = { analyzePlacementProfile, generatePresentationLanguage, testConnection };
