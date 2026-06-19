const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Shared internal helper to initialize the Google Generative AI client workspace.
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from environment variables configuration.");
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * 🚀 1. DEDICATED TEST CONNECTION FUNCTION
 * Executes a simple, lightweight string validation check with the Gemini API node.
 */
const testConnection = async () => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = "Reply with exactly: Gemini connection successful";

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

/**
 * 🚀 2. SEPARATE CORE ASSESSMENT FUNCTION
 * Orchestrates full prompt tuning layout parameters for complete profile calculations.
 */
const analyzePlacementProfile = async (profileData) => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", // Upgraded version parameters
    generationConfig: { responseMimeType: "application/json" }
  });

  const resumeSectionPrompt = profileData.resumeText
    ? `[CRITICAL EXTRACTED RESUME TEXT FOR ANALYSIS]:\n${profileData.resumeText}`
    : `[RESUME STATUS]: User chose to skip the optional resume upload phase. Base the complete evaluation metrics purely on the structural parameters questionnaire records provided above. Do NOT penalize their general readinessScore for skipping the resume, but output the resumeScore strictly as a primitive null value.`;

  const prompt = `
You are the elite automated AI Placement Analysis Engine for a college engineering placement application.
Your core objective is to calculate an analytical assessment of an engineering student based on their complete profile parameters.

[STUDENT CONTEXT]:
- Academic Branch: ${profileData.branch}
- Target Graduation Year: ${profileData.year}
- Verified Cumulative CGPA: ${profileData.cgpa}
- Targeted Enterprise Environment: ${profileData.companyType}
- Target Engineering Position: ${profileData.targetRole}

[TECHNICAL SKILLS MATRIX EVALUATION]:
- Data Structures & Algorithms (DSA): ${profileData.skills?.dsa || "Not Provided"}
- Database Management Systems (DBMS): ${profileData.skills?.dbms || "Not Provided"}
- Operating Systems (OS): ${profileData.skills?.os || "Not Provided"}
- Computer Networks (CN): ${profileData.skills?.networks || "Not Provided"}
- Quantitative Aptitude: ${profileData.skills?.aptitude || "Not Provided"}
- Professional Communication: ${profileData.skills?.communication || "Not Provided"}

[PREPARATION COMMITMENT VARIABLES]:
- Dedicated Prep Timeline Window: ${profileData.timeline?.preparationTimelineMonths || "Flexible"} months
- Daily Study Capacity Allocation: ${profileData.timeline?.dailyStudyHours || "Variable"} hours/day

${resumeSectionPrompt}

[STRICT ARCHITECTURAL COMPLIANCE INSTRUCTIONS]:
Evaluate the dataset and reply with a pure JSON object mapping the exact keys listed below. Do NOT prefix or append text outside the JSON block.

Required Schema Format Structure:
{
  "readinessScore": 72,
  "resumeScore": 85,    
  "strengths": ["Strong foundational metrics in DSA", "High academic performance continuity based on CGPA"],
  "weaknesses": ["Requires advanced system concept deep-dives", "Daily commitment windows are constrained"],
  "missingSkills": ["System Design fundamentals", "Advanced SQL optimization tools"],
  "recommendations": ["Dedicate an incremental 2 hours daily specifically targeting core OS architectures", "Build production-ready CRUD modules to stabilize DBMS visibility"]
}
`.trim();

  const result = await model.generateContent(prompt);
  const rawResponseText = result.response.text();

  try {
    return JSON.parse(rawResponseText.trim());
  } catch (parseError) {
    console.error("❌ Gemini Response JSON Structural Deserialization Failure:", rawResponseText);
    throw new Error("Failed to parse AI response into a valid runtime JSON object format.");
  }
};

module.exports = {
  testConnection,
  analyzePlacementProfile
};