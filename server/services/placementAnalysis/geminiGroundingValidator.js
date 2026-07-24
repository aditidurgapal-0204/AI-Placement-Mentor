const { validatePresentationSafeGeminiOutput } = require("../../contracts/presentationSafeGemini.v1");

const numberTokens = (value) => String(value || "").match(/\b\d+(?:\.\d+)?\b/g) || [];
const collectApprovedNumbers = (input) => new Set(numberTokens(JSON.stringify(input)));
const outputTexts = (output) => [
  output?.diagnosis,
  ...(output?.strengths || []).map(({ text }) => text),
  ...(output?.scoreBlockers || []).map(({ text }) => text),
  ...(output?.careerRisks || []).map(({ text }) => text),
  output?.priority?.text
].filter((value) => typeof value === "string");

const INTERNAL_LANGUAGE = /\b(?:verified evidence(?: supports)?|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration|score contribution|capability family|reasoning dimension|confidence aggregation)\b/i;
const sentenceCount = (value) => (String(value || "").match(/[.!?](?:\s|$)/g) || []).length;
const wordCount = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
const evidenceInsights = (input) => [...(input?.strengths || []), ...(input?.scoreBlockers || []), ...(input?.careerRisks || [])];
const safeEvidence = (input) => evidenceInsights(input).flatMap(({ evidence }) => evidence ? [evidence] : []);
const approvedProjectNames = (input) => new Set(safeEvidence(input).flatMap(({ projectExamples = [] }) => projectExamples.map(({ name }) => normalize(name))));
const approvedTechnologies = (input) => new Set(safeEvidence(input).flatMap(({ projectExamples = [] }) => projectExamples.flatMap(({ technologies = [] }) => technologies.map(normalize))));
const approvedSkillPairs = (input) => new Set(safeEvidence(input).flatMap(({ skillFacts = [] }) => skillFacts.map(({ skill, level }) => `${normalize(skill)}:${normalize(level)}`)));
const claimProjectNames = (text) => [...String(text || "").matchAll(/\b([A-Z][A-Za-z0-9+#.-]*(?:\s+[A-Z][A-Za-z0-9+#.-]*){0,4})\s+(?:[Pp]roject|[Aa]pplication|[Pp]latform|[Ww]ebsite|[Ss]ervice)\b/g)]
  .map((match) => normalize(match[1])).filter((name) => !["your", "the", "this", "a", "an", "full stack", "frontend", "backend", "machine learning"].includes(name));
const claimTechnologyAfterMarker = (text) => [...String(text || "").matchAll(/\b(?:using|built with|implemented with|developed with|through)\s+([A-Z][A-Za-z0-9+#.-]{1,30})\b/g)]
  .map((match) => normalize(match[1]));

const validateGeminiGrounding = (output, input) => {
  const contract = validatePresentationSafeGeminiOutput(output, input);
  const errors = [...contract.errors];
  const approvedNumbers = collectApprovedNumbers(input);

  if (typeof output?.diagnosis === "string") {
    const sentences = sentenceCount(output.diagnosis);
    const words = wordCount(output.diagnosis);
    if (sentences < 3 || sentences > 7) errors.push("diagnosis must contain between three and seven complete sentences");
    if (words < 45 || words > 190) errors.push("diagnosis must contain between 45 and 190 words");
  }

  outputTexts(output).forEach((value, index) => {
    if (INTERNAL_LANGUAGE.test(value)) errors.push(`output text ${index} contains internal analytics language`);
    numberTokens(value).forEach((number) => {
      if (!approvedNumbers.has(number)) errors.push(`output text ${index} contains unapproved numeric claim ${number}`);
    });
    const projects = approvedProjectNames(input);
    claimProjectNames(value).forEach((name) => {
      if (![...projects].some((approved) => approved === name || approved.startsWith(`${name} `) || name.startsWith(`${approved} `))) {
        errors.push(`output text ${index} contains unapproved project name ${name}`);
      }
    });
    const technologies = approvedTechnologies(input);
    claimTechnologyAfterMarker(value).forEach((technology) => {
      if (!technologies.has(technology)) errors.push(`output text ${index} contains unapproved technology ${technology}`);
    });
    const skills = approvedSkillPairs(input);
    [...String(value).matchAll(/\b(beginner|intermediate|advanced|weak|average|strong)\s+(?:level\s+)?(dsa|dbms|operating systems?|os|computer networks?|networks?|aptitude|communication)\b/gi)]
      .forEach((match) => {
        const aliases = { "operating system": "os", "operating systems": "os", "computer network": "networks", "computer networks": "networks", network: "networks" };
        const skill = aliases[normalize(match[2])] || normalize(match[2]);
        if (!skills.has(`${skill}:${normalize(match[1])}`)) errors.push(`output text ${index} contains unapproved skill-level claim`);
      });
  });

  const combined = normalize(outputTexts(output).join(" "));
  const facts = safeEvidence(input).flatMap(({ experienceFacts = [], leadershipFacts = [] }) => [...experienceFacts, ...leadershipFacts]);
  const hasFact = (type) => facts.some((fact) => fact.type === type && (fact.detail === "detected" || fact.detail?.exists === true || fact.detail));
  if (/\binternship\b/.test(combined) && !hasFact("internship") && !/\b(?:absence|without|no|limited|needs?|gain)\b/.test(combined)) errors.push("output contains unsupported internship claim");
  if (/\bgithub\b|\bcode portfolio\b/.test(combined) && !hasFact("code_portfolio")) errors.push("output contains unsupported GitHub claim");
  if (/\bcertif(?:icate|ication|ied)\b/.test(combined) && !hasFact("certification") && !hasFact("certification_detail")) errors.push("output contains unsupported certification claim");

  (output?.careerRisks || []).forEach(({ text }, index) => {
    const claimsScoreEffect = /\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?|costs?)\b[^.]{0,50}\b(?:score|readiness points?)\b|\b(?:score|readiness points?)\b[^.]{0,50}\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?)\b/i.test(text || "");
    const explicitlyNegatesScoreEffect = /\b(?:does|did|will|would|can)\s+not\s+(?:lower|reduce|decrease|deduct|cost)\b/i.test(text || "");
    if (claimsScoreEffect && !explicitlyNegatesScoreEffect) {
      errors.push(`careerRisks[${index}] must not claim current score causality`);
    }
  });

  return { valid: errors.length === 0, errors };
};

module.exports = { validateGeminiGrounding };
