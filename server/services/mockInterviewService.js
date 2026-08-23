const { randomUUID } = require("node:crypto");
const { detectSections } = require("./resume/sectionDetector");
const { TECHNOLOGY_CATALOG } = require("./readiness/structuredProjectEvidence");
const geminiService = require("./geminiService");
const { INTERVIEW_VERSION, DIMENSIONS, QUESTION_CATEGORIES, cleanText, validateSetup, normalizeQuestion } = require("../contracts/mockInterview.v1");

const SESSION_TTL_MS = 60 * 60 * 1000;
const sessions = new Map();
const ROLE_FUNDAMENTALS = {
  "Software Development Engineer (SDE)": ["DSA", "OOP", "DBMS", "Operating Systems", "Computer Networks", "programming fundamentals", "system design", "problem solving"],
  "ML Engineer": ["Python", "machine learning fundamentals", "statistics", "data preprocessing", "feature engineering", "model evaluation", "ML algorithms", "SQL", "DSA"],
  "Data Analyst": ["SQL", "statistics", "Python", "data analysis", "data cleaning", "visualization", "analytical reasoning", "case analysis"],
  "Frontend Developer": ["JavaScript", "React", "HTML", "CSS", "browser fundamentals", "state management", "API integration", "frontend performance", "web fundamentals", "DSA"]
};
const HR_FALLBACKS = {
  introduction: "Tell me about yourself.",
  strengths: "What is one strength you rely on, and when have you demonstrated it?",
  weaknesses: "What is one genuine weakness you are actively working to improve?",
  teamwork: "Tell me about a time you contributed to a team outcome.",
  conflict: "Describe a disagreement in a team and how you handled it.",
  leadership: "Tell me about a time you took ownership or helped others move forward.",
  failure: "Describe a setback or failure and what you changed afterward.",
  challenges: "What has been your most difficult recent challenge, and how did you approach it?",
  goals: "What are your immediate career goals, and why do they matter to you?",
  motivation: "What motivates you to do your best work when a task becomes difficult?",
  pressure: "How do you prioritize when several important tasks have the same deadline?",
  communication: "Tell me about a time clear communication changed the outcome of a situation.",
  fit: "Why should an organization choose you for an entry-level opportunity?"
};
const ROLE_FUNDAMENTAL_QUESTIONS = {
  "Software Development Engineer (SDE)": [
    { topic: "DSA", question: "Suppose you need to detect duplicate values in a large array. Which data structure would you use, and what are its time and space costs?" },
    { topic: "OOP", question: "When would you choose composition over inheritance in an object-oriented design? Give one concrete reason." },
    { topic: "DBMS", question: "A database query that was fast becomes slow as the table grows. What would you inspect first, and how could an index help or hurt?" },
    { topic: "Operating Systems", question: "What is the practical difference between a process and a thread, and when would multiple threads be useful?" },
    { topic: "Computer Networks", question: "What happens between entering a URL in a browser and receiving the first HTTP response?" },
    { topic: "system design", question: "How would you prevent two clients from creating duplicate records when they submit the same request at nearly the same time?" }
  ],
  "ML Engineer": [
    { topic: "model evaluation", question: "For an imbalanced classification problem, why can accuracy be misleading, and which metrics would you inspect instead?" },
    { topic: "data preprocessing", question: "How would you handle missing values without leaking information from the test set into training?" },
    { topic: "feature engineering", question: "How would you decide whether a new feature genuinely improves a model rather than only fitting noise?" },
    { topic: "statistics", question: "What does a confidence interval tell you, and what is a common mistake when interpreting it?" },
    { topic: "ML algorithms", question: "When might a simpler linear model be preferable to a more complex tree-based model?" }
  ],
  "Data Analyst": [
    { topic: "SQL", question: "How would you find customers whose monthly spending increased for three consecutive months using SQL?" },
    { topic: "statistics", question: "A metric improved after a product change. How would you determine whether the change probably caused the improvement?" },
    { topic: "data cleaning", question: "You find duplicate records and inconsistent category names in a dataset. How would you clean them without losing valid data?" },
    { topic: "visualization", question: "Which chart would you use to explain a distribution with strong outliers, and why?" },
    { topic: "case analysis", question: "Daily active users fell by 15% this week. What would you investigate before proposing a cause?" }
  ],
  "Frontend Developer": [
    { topic: "JavaScript", question: "What is the difference between the JavaScript event loop, microtasks, and regular task callbacks in observable execution order?" },
    { topic: "React", question: "A React component re-renders much more often than expected. How would you identify the cause before adding memoization?" },
    { topic: "state management", question: "How do you decide whether state belongs locally in a component, in context, or in a shared store?" },
    { topic: "browser fundamentals", question: "What causes browser layout and paint work, and how would you investigate a visibly janky interaction?" },
    { topic: "API integration", question: "How would you prevent stale API responses from replacing newer search results in a frontend interface?" }
  ]
};
const PROBLEM_SOLVING_QUESTIONS = {
  "Software Development Engineer (SDE)": ["An API occasionally creates duplicate records under concurrent requests. Walk me through how you would reproduce, diagnose, and fix it."],
  "ML Engineer": ["A model performs well offline but poorly after deployment. Walk me through how you would isolate whether the problem is data drift, serving logic, or evaluation design."],
  "Data Analyst": ["Two dashboards report different values for the same business metric. How would you determine which result is trustworthy?"],
  "Frontend Developer": ["A page is fast locally but slow for real users on mobile networks. How would you identify the bottleneck and verify an improvement?"]
};
const SKILL_QUESTIONS = {
  Java: "Java appears in your resume. When would you use an interface instead of an abstract class, and what limitation would influence that choice?",
  Python: "Python appears in your resume. When would you use a generator instead of returning a list, and what trade-off does that introduce?",
  React: "React appears in your resume. What causes a component to re-render, and how would you investigate an unnecessary re-render?",
  JavaScript: "JavaScript appears in your resume. Explain how closures retain access to surrounding state and give one practical use case.",
  PostgreSQL: "PostgreSQL appears in your resume. How would you investigate a slow query, and what trade-off can adding an index introduce?",
  SQL: "SQL appears in your resume. When can a LEFT JOIN unexpectedly behave like an INNER JOIN because of a filter?",
  "Node.js": "Node.js appears in your resume. What kind of work can block its event loop, and how would you keep the server responsive?",
  "Next.js": "Next.js appears in your resume. How would you decide whether data should be fetched on the server or in the browser for a page?",
  Express: "Express appears in your resume. How would you structure error handling so asynchronous route failures return consistent responses?",
  Prisma: "Prisma appears in your resume. When would you use a transaction, and what failure would it prevent?"
};

const now = () => Date.now();
const cleanupExpiredSessions = () => { for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id); };
const cleanupTimer = setInterval(cleanupExpiredSessions, 10 * 60 * 1000); cleanupTimer.unref?.();
const unique = (values) => [...new Set(values.filter(Boolean))];
const containsTerm = (text, term) => new RegExp(`(?:^|[^a-z0-9])${String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(text);

const humanizeProjectName = (value) => String(value || "")
  .replace(/[|｜].*$/, "")
  .replace(/\s*(?:[—–]|-\s+)\s*(?:full[\s-]*stack|web|mobile|machine|ai|data).*/i, "")
  .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4}.*$/i, "")
  .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/([a-zA-Z])(\d)/g, "$1 $2")
  .replace(/(\d)([a-zA-Z])/g, "$1 $2")
  .replace(/\s+/g, " ")
  .replace(/[—–-]+$/, "")
  .trim();
const isLikelyProjectHeader = (value) => {
  const line = String(value || "").trim();
  const words = line.replace(/[|｜—–-].*$/, "").trim().split(/\s+/).filter(Boolean);
  if (line.length < 3 || line.length > 140 || words.length > 8 || /[.!?;:]$/.test(line)) return false;
  if (/\b(?:guidance|recommendations?|personalized|usability|users?|helps?|provides?|worked|responsible|developed|built|implemented|created|designed|integrated|deployed|improved)\b/i.test(line)) return false;
  if (/^(?:full[\s-]*stack|web|mobile|ai|machine learning|data)(?:\s+(?:web|mobile|ai|application|platform|system)){1,4}$/i.test(line)) return false;
  const hasHeaderSeparator = /[|｜—–]/.test(line);
  const hasCamelCaseName = /[a-z][A-Z]/.test(line);
  const titleLikeWords = words.filter((word) => /^[A-Z0-9][A-Za-z0-9+#.]*$/.test(word)).length;
  return hasHeaderSeparator || hasCamelCaseName || (words.length <= 6 && titleLikeWords >= Math.ceil(words.length / 2));
};

const extractTechnicalContext = (resumeText, targetRole) => {
  const sections = detectSections(resumeText);
  const technologies = TECHNOLOGY_CATALOG.filter((technology) => containsTerm(resumeText, technology)).slice(0, 18);
  const projectLines = String(sections.projects || "").split(/\r?\n/).map((line) => line.replace(/^[•*\-\s]+/, "").trim()).filter(Boolean);
  const projects = unique(projectLines.filter((line) => isLikelyProjectHeader(line) && !/^\d{4}/.test(line)).map(humanizeProjectName).filter((line) => line.length >= 3 && line.length <= 70)).slice(0, 4);
  return {
    targetRole,
    projects,
    technologies,
    educationPresent: Boolean(sections.education.trim()),
    experiencePresent: Boolean(sections.experience.trim()),
    certificationsPresent: Boolean(sections.certifications.trim()),
    fundamentals: ROLE_FUNDAMENTALS[targetRole]
  };
};

const coverageCount = (session, category) => session.coverage[category] || 0;
const questionWords = (value) => new Set(String(value || "").toLowerCase().match(/[a-z0-9+#.]{3,}/g)?.filter((word) => !new Set(["the", "and", "that", "this", "with", "your", "you", "what", "when", "which", "would", "could", "about", "from", "into", "have"]).has(word)) || []);
const questionSimilarity = (left, right) => {
  const a = questionWords(left); const b = questionWords(right);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.min(a.size, b.size);
};
const askedQuestions = (session) => unique([...session.turns.map((turn) => turn.question.question), session.currentQuestion?.question]);
const normalizedQuestionText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
const questionRepeated = (question, session) => {
  const normalized = normalizedQuestionText(question);
  return askedQuestions(session).some((asked) => {
    const previous = normalizedQuestionText(asked);
    return normalized.includes(previous) || previous.includes(normalized) || questionSimilarity(question, asked) >= 0.62;
  });
};
const firstUnused = (candidates, session) => candidates.find((candidate) => !questionRepeated(candidate.question, session));
const hrFollowUp = (answer) => {
  if (/conflict|disagree|different opinion|argument/i.test(answer)) return { category: "conflict", topic: "conflict handling", question: "How did you respond to that disagreement, and what was the eventual outcome?", isFollowUp: true };
  if (/project|built|developed|team/i.test(answer)) return { category: "teamwork", topic: "project contribution", question: "Choose one project or team experience you mentioned. What was the hardest problem you personally solved, and what changed because of your work?", isFollowUp: true };
  if (/\b(?:I failed|my failure|mistake|setback)\b/i.test(answer)) return { category: "failure", topic: "learning from setbacks", question: "What specific change did you make after that experience?", isFollowUp: true };
  return null;
};

const projectCandidates = (session) => {
  const project = session.resumeContext.projects[coverageCount(session, "project") % Math.max(session.resumeContext.projects.length, 1)];
  if (!project) return [];
  return [
    { question: `Walk me through ${project}: what problem does it solve, how do its main components work together, and which parts did you personally build?`, category: "project", topic: project, isFollowUp: false },
    { question: `In ${project}, what was the hardest technical decision you made, which alternatives did you consider, and why did you choose your final approach?`, category: "project", topic: project, isFollowUp: true },
    { question: `Tell me about one failure, bottleneck, or difficult bug in ${project}. How did you isolate the cause and verify the fix?`, category: "project", topic: project, isFollowUp: true }
  ];
};
const skillCandidate = (session, lastAnswer) => {
  const context = session.resumeContext;
  const mentioned = context.technologies.find((technology) => containsTerm(lastAnswer, technology));
  const technology = mentioned || context.technologies[coverageCount(session, "skill") % Math.max(context.technologies.length, 1)];
  if (!technology) return null;
  const specific = SKILL_QUESTIONS[technology] || `${technology} appears in your resume. Describe one decision where ${technology} was a better fit than an alternative, and name one limitation you had to consider.`;
  const question = mentioned ? specific.replace(`${technology} appears in your resume.`, `You mentioned ${technology} in your previous answer.`) : specific;
  return { question, category: "skill", topic: technology, isFollowUp: Boolean(mentioned) };
};
const fundamentalCandidate = (session) => {
  const questions = ROLE_FUNDAMENTAL_QUESTIONS[session.targetRole];
  const selected = questions[coverageCount(session, "fundamentals") % questions.length];
  return { ...selected, category: "fundamentals", isFollowUp: false };
};
const problemSolvingCandidate = (session) => ({ question: PROBLEM_SOLVING_QUESTIONS[session.targetRole][0], category: "problem-solving", topic: "diagnostic reasoning", isFollowUp: false });

const fallbackQuestion = (session, lastAnswer = "") => {
  if (session.type === "hr") {
    const followUp = hrFollowUp(lastAnswer);
    if (followUp && coverageCount(session, followUp.category) < 2 && !questionRepeated(followUp.question, session)) return followUp;
    const candidates = [...QUESTION_CATEGORIES.hr]
      .sort((a, b) => coverageCount(session, a) - coverageCount(session, b))
      .map((category) => ({ question: HR_FALLBACKS[category], category, topic: category, isFollowUp: false }));
    return firstUnused(candidates, session) || candidates[0];
  }
  const byCategory = {
    project: projectCandidates(session),
    skill: [skillCandidate(session, lastAnswer)].filter(Boolean),
    fundamentals: [fundamentalCandidate(session)],
    "problem-solving": [problemSolvingCandidate(session)]
  };
  const orderedCategories = [...QUESTION_CATEGORIES.technical].sort((a, b) => coverageCount(session, a) - coverageCount(session, b));
  for (const category of orderedCategories) {
    const candidate = firstUnused(byCategory[category], session);
    if (candidate) return candidate;
  }
  return fundamentalCandidate(session);
};

const matchedTerms = (answer, terms) => terms.filter((term) => containsTerm(answer, term));
const naturalList = (items) => items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0];
const ANSWER_QUALITY = Object.freeze({ INSUFFICIENT: "INSUFFICIENT", PARTIAL: "PARTIAL", SUBSTANTIVE: "SUBSTANTIVE" });
const TECHNICAL_EVIDENCE_TERMS = unique([
  ...TECHNOLOGY_CATALOG, "HashMap", "HashSet", "array", "linked list", "stack", "queue", "tree", "graph", "algorithm", "data structure",
  "O(1)", "O(n)", "O(n log n)", "time complexity", "space complexity", "recursion", "binary search", "sorting", "collision", "average case", "worst case",
  "interface", "abstract class", "composition", "inheritance", "encapsulation", "polymorphism", "normalization", "memory", "latency", "frontend", "backend", "database", "API", "architecture",
  "process", "thread", "index", "query", "transaction", "constraint", "event loop", "state", "props", "render", "model", "feature",
  "accuracy", "precision", "recall", "training", "test set", "visualization", "metric", "log", "edge case", "trade-off", "alternative"
]);
const acknowledgementOnly = /^(?:ok(?:ay)?|yes|no|idk|i\s*(?:do not|don'?t)\s*know|skip|fine|maybe|sure|nothing|na|n\/a|[.\-–—])(?:[.!?]*)$/i;
const nonAnswerLanguage = /\b(?:i\s*(?:do not|don'?t)\s*know|no idea|not sure|cannot answer|can'?t answer|don'?t understand|skip this|no clue)\b/i;
const technicalEvidenceForQuestion = (session) => {
  const question = session.currentQuestion;
  const topic = question.topic;
  if (question.category === "project") return unique([...session.resumeContext.technologies, topic, "project", "architecture", "frontend", "backend", "database", "API", "component", "service", "authentication", "deployment", "trade-off", "alternative", "result", "test", "log"]);
  if (question.category === "problem-solving") return ["requirements", "input", "output", "constraint", "edge case", "reproduce", "log", "metric", "test", "debug", "root cause", "alternative", "trade-off", "complexity", "verify", "transaction", "race condition", "unique constraint"];
  const topicTerms = {
    DSA: ["HashMap", "HashSet", "array", "linked list", "stack", "queue", "tree", "graph", "algorithm", "data structure", "recursion", "binary search", "sorting", "O(1)", "O(n)", "time complexity", "space complexity"],
    OOP: ["OOP", "interface", "abstract class", "composition", "inheritance", "encapsulation", "polymorphism", "class", "object"],
    DBMS: ["DBMS", "database", "query", "index", "normalization", "transaction", "constraint", "table", "join"],
    "Operating Systems": ["process", "thread", "memory", "scheduling", "deadlock", "context switch", "concurrency"],
    "Computer Networks": ["HTTP", "DNS", "TCP", "IP", "request", "response", "network", "TLS"],
    Python: ["Python", "generator", "iterator", "list", "yield", "lazy evaluation", "class", "object"],
    Java: ["Java", "interface", "abstract class", "inheritance", "class", "object"],
    React: ["React", "state", "props", "component", "render", "hook", "effect", "memoization", "profiler"],
    JavaScript: ["JavaScript", "closure", "scope", "event loop", "promise", "callback", "microtask"],
    PostgreSQL: ["PostgreSQL", "query", "index", "transaction", "database", "table", "join"],
    SQL: ["SQL", "join", "query", "table", "filter", "group by", "window function"],
    "Node.js": ["Node.js", "event loop", "async", "promise", "worker", "stream", "I/O"],
    "Next.js": ["Next.js", "server rendering", "client rendering", "server component", "routing", "cache"],
    Express: ["Express", "middleware", "route", "request", "response", "error handling"],
    Prisma: ["Prisma", "transaction", "migration", "query", "schema", "ORM"]
  };
  return unique([topic, ...(topicTerms[topic] || []), ...TECHNOLOGY_CATALOG.filter((technology) => containsTerm(question.question, technology))]);
};
const hrEvidenceSignals = (category, answer) => {
  const patterns = {
    introduction: [/(?:student|graduate|degree|education|engineer|developer|analyst)/i, /(?:project|internship|experience|worked|built)/i, /(?:goal|role|career|seeking|looking for)/i],
    strengths: [/(?:strength|persistence|communication|leadership|problem[- ]solving|teamwork|adaptability|discipline|organized|patient|creative)/i, /(?:example|when|project|team|situation)/i, /(?:result|helped|improved|completed|delivered|resolved)/i],
    weaknesses: [/(?:weakness|struggle|sometimes|difficulty|improve|working on)/i, /(?:plan|practice|priority|deadline|habit|feedback|setting)/i, /(?:progress|better|improved|efficient|reduced)/i],
    teamwork: [/(?:team|project|together|collaborat|contribut)/i, /\bI\s+(?:built|implemented|organized|helped|decided|resolved|handled|created)/i, /(?:result|outcome|completed|delivered|learned|improved)/i],
    conflict: [/(?:conflict|disagree|different opinion|argument|decision)/i, /\bI\s+(?:listened|compared|explained|proposed|resolved|responded|handled|asked)/i, /(?:outcome|agreed|resolved|completed|relationship|learned)/i],
    leadership: [/(?:led|leadership|ownership|initiative|guided|mentored|coordinated)/i, /\bI\s+(?:decided|organized|assigned|helped|proposed|created)/i, /(?:result|outcome|completed|delivered|improved)/i],
    failure: [/(?:failed|failure|mistake|setback|problem|went wrong)/i, /\bI\s+(?:fixed|changed|learned|debugged|reviewed|asked)/i, /(?:afterward|since then|result|lesson|prevent)/i],
    challenges: [/(?:challenge|difficult|problem|constraint|obstacle)/i, /\bI\s+(?:broke|compared|solved|handled|prioritized|decided)/i, /(?:result|outcome|learned|completed|improved)/i],
    goals: [/(?:goal|career|role|learn|develop|grow|future)/i, /(?:because|motivated|interested|impact)/i],
    motivation: [/(?:motivat|enjoy|interested|purpose|impact|learn)/i, /(?:example|when|project|work)/i],
    pressure: [/(?:deadline|pressure|urgent|priorit|multiple tasks)/i, /\bI\s+(?:plan|rank|communicate|break|schedule|focus)/i, /(?:completed|delivered|result|on time)/i],
    communication: [/(?:communicat|explained|listened|message|feedback|clarif)/i, /(?:result|outcome|resolved|understood|agreed)/i],
    fit: [/(?:hire|role|value|contribute|skills|experience|strength)/i, /(?:project|internship|evidence|example|built|achieved)/i]
  };
  return (patterns[category] || patterns.teamwork).map((pattern) => pattern.test(answer));
};
const classifyAnswer = (session, answer) => {
  const normalized = answer.replace(/\s+/g, " ").trim();
  const words = normalized.match(/[a-z0-9+#.]+/gi) || [];
  if (!normalized || acknowledgementOnly.test(normalized) || nonAnswerLanguage.test(normalized)) return ANSWER_QUALITY.INSUFFICIENT;
  if (session.type === "technical") {
    const evidenceTerms = matchedTerms(normalized, technicalEvidenceForQuestion(session));
    const hasTechnicalReasoning = /\b(?:because|therefore|so that|which means|works by|first|then|if|otherwise|instead|compared|trade-?off|complexity|cost|requires|allows|prevents)\b/i.test(normalized);
    if (!evidenceTerms.length) return ANSWER_QUALITY.INSUFFICIENT;
    if (words.length < 12 || evidenceTerms.length < 2 || !hasTechnicalReasoning) return ANSWER_QUALITY.PARTIAL;
    return ANSWER_QUALITY.SUBSTANTIVE;
  }
  const signals = hrEvidenceSignals(session.currentQuestion.category, normalized);
  const evidenceCount = signals.filter(Boolean).length;
  if (!evidenceCount) return ANSWER_QUALITY.INSUFFICIENT;
  if (session.currentQuestion.category === "conflict" && session.currentQuestion.isFollowUp && signals[2] && words.length >= 8) return ANSWER_QUALITY.SUBSTANTIVE;
  if (words.length < 14 || evidenceCount < 2) return ANSWER_QUALITY.PARTIAL;
  return ANSWER_QUALITY.SUBSTANTIVE;
};
const zeroRatings = (type) => Object.fromEntries(DIMENSIONS[type].map((dimension) => [dimension, 0]));
const partialRatings = (type) => Object.fromEntries(DIMENSIONS[type].map((dimension, index) => [dimension, index === 0 ? 2 : 1]));
const expectedAnswerGuidance = (session) => {
  const question = session.currentQuestion;
  if (session.type === "technical") {
    if (question.category === "project") return `Explain ${question.topic}'s purpose, its main technical components, your own contribution, and the decision or result requested by the question.`;
    if (question.category === "skill") return `Explain the ${question.topic} concept being tested, how it works, and one example or trade-off relevant to the question.`;
    if (question.category === "fundamentals") return `State the ${question.topic} concept or choice, explain the reasoning, and include complexity, cost, or trade-offs where the question requires them.`;
    return "Describe how you would reproduce the problem, inspect evidence, choose a solution, and verify that the solution worked.";
  }
  const guidance = {
    introduction: "Provide a concise background, relevant education or experience, one strong proof point, and your career direction.",
    strengths: "Name one clear strength and support it with a specific example and result.",
    weaknesses: "Name a genuine manageable weakness, its impact, the action you are taking, and evidence of progress.",
    conflict: session.currentQuestion.isFollowUp ? "State how you responded, the eventual outcome, and what you learned." : "Describe the disagreement, your responsibility, your specific action, and the outcome.",
    teamwork: "Describe the team context, your personal contribution, and the resulting team outcome.",
    leadership: "Explain what you took ownership of, the actions you led, and the result for others or the work.",
    failure: "Describe the setback, your responsibility, what you changed, and the lesson or later result.",
    challenges: "Describe the challenge, options considered, your action, and the result.",
    goals: "State a specific career goal, why it matters, and the next capability you plan to build.",
    motivation: "Explain what motivates you and support it with one concrete example.",
    pressure: "Explain the prioritization method, communication, and outcome under pressure.",
    communication: "Describe what needed communicating, what you changed, and how the outcome was affected.",
    fit: "Connect your relevant strengths and evidence directly to the value you would bring to the role."
  };
  return guidance[question.category] || guidance.teamwork;
};
const insufficientEvaluation = (session) => ({
  quality: ANSWER_QUALITY.INSUFFICIENT,
  ratings: zeroRatings(session.type),
  whatWentWell: [session.type === "technical" ? "No assessable technical evidence was provided in this response." : "No assessable behavioral evidence was provided in this response."],
  improvements: [`The response was insufficient. ${expectedAnswerGuidance(session)}`],
  betterApproach: expectedAnswerGuidance(session)
});
const partialEvaluation = (session, answer) => {
  const question = session.currentQuestion;
  if (session.type === "technical") {
    const terms = matchedTerms(answer, technicalEvidenceForQuestion(session));
    const hashTerm = terms.find((term) => /hash(?:map|set|ing)/i.test(term));
    const positive = hashTerm && /duplicate|array/i.test(question.question)
      ? "You identified a hash-based data structure as an appropriate direction for detecting duplicates."
      : `You identified ${naturalList(terms.slice(0, 3))} as relevant to the question.`;
    const missing = hashTerm && /duplicate|array/i.test(question.question)
      ? "You did not explain how the hash-based structure would detect duplicates or provide the expected time and space complexity."
      : `The response is incomplete. ${expectedAnswerGuidance(session)}`;
    return { quality: ANSWER_QUALITY.PARTIAL, ratings: partialRatings(session.type), whatWentWell: [positive], improvements: [missing], betterApproach: expectedAnswerGuidance(session) };
  }
  const category = question.category;
  const positive = category === "introduction" ? "You provided one relevant background detail, but not enough information for a complete introduction."
    : category === "strengths" ? "You identified a possible strength, but did not provide enough evidence to demonstrate it."
      : category === "weaknesses" ? "You identified a possible weakness or improvement point, but the response did not show the full improvement process."
        : category === "conflict" ? "You provided one relevant detail about the disagreement or response, but the behavioral example is incomplete."
          : `You provided one relevant point about ${question.topic}, but not enough evidence for a complete evaluation.`;
  return { quality: ANSWER_QUALITY.PARTIAL, ratings: partialRatings(session.type), whatWentWell: [positive], improvements: [`The response is incomplete. ${expectedAnswerGuidance(session)}`], betterApproach: expectedAnswerGuidance(session) };
};
const fallbackEvaluation = (session, answer) => {
  const question = session.currentQuestion;
  const quality = classifyAnswer(session, answer);
  if (quality === ANSWER_QUALITY.INSUFFICIENT) return insufficientEvaluation(session);
  if (quality === ANSWER_QUALITY.PARTIAL) return partialEvaluation(session, answer);
  const words = answer.split(/\s+/).filter(Boolean).length;
  const hasStructure = /\b(?:first|then|next|after that|finally|because|therefore|situation|action|result)\b/i.test(answer);
  const hasExample = /\b(?:for example|project|team|when|during|implemented|built|used|handled|created)\b/i.test(answer);
  const hasOutcome = /\b(?:result|outcome|learned|improved|resolved|completed|achieved|reduced|increased|delivered|helped)\b|\d+%/i.test(answer);
  const hasOwnership = /\bI\s+(?:built|implemented|created|designed|integrated|debugged|handled|led|organized|decided|compared|worked|used|chose)\b/i.test(answer);
  const hasTradeOff = /\b(?:trade-?off|alternative|compared|choice|chose|instead|however|but|limitation|cost|space|memory|latency|complexity|scalab|maintainab)\b/i.test(answer);
  const base = words >= 45 ? 3 : words >= 20 ? 2 : words >= 8 ? 1 : 0;
  const ratings = Object.fromEntries(DIMENSIONS[session.type].map((dimension, index) => [dimension, Math.min(4, base + (index % 3 === 0 && hasExample ? 1 : 0) + (index % 3 === 1 && hasStructure ? 1 : 0) + (index % 3 === 2 && (hasOutcome || hasTradeOff) ? 1 : 0))]));
  const conciseGuidance = words > 150 ? `The answer is ${words} words long; reduce it to the most relevant two or three points so it is easier to deliver in an interview.` : null;

  if (session.type === "hr") {
    const category = question.category;
    const whatWentWell = [];
    const improvements = [];
    let betterApproach;
    if (category === "introduction") {
      const details = matchedTerms(answer, ["student", "software development", "project", "internship", "backend", "frontend"]);
      if (details.length) whatWentWell.push(`You introduced concrete background details, including ${naturalList(details.slice(0, 3))}.`);
      if (hasOwnership) whatWentWell.push("You made your own contribution visible instead of only describing the project generally.");
      if (!/\b(?:goal|role|career|looking for|seeking)\b/i.test(answer)) improvements.push("Close the introduction with the kind of role you are targeting and the value you want to contribute.");
      betterApproach = "Use four short parts: current education/status → strongest technical focus → one proof point such as a project or internship → the role you are seeking.";
    } else if (category === "strengths") {
      const namedStrengths = matchedTerms(answer, ["persistence", "communication", "leadership", "problem solving", "teamwork", "adaptability", "discipline"]);
      if (namedStrengths.length) whatWentWell.push(`You named ${naturalList(namedStrengths)} as a strength and supported it with context.`);
      if (hasExample) whatWentWell.push("You supported the claimed strength with a real situation rather than leaving it as a label.");
      if (!hasOutcome) improvements.push("Finish the example with the observable result of using that strength.");
      betterApproach = "Name one strength → give one brief situation → explain your specific action → end with the result that proves the strength.";
    } else if (category === "weaknesses") {
      if (/\b(?:working on|improving|set|setting|practice|plan|deadline|deadlines|priority|priorities)\b/i.test(answer)) whatWentWell.push("You paired the weakness with concrete steps you are taking to improve it.");
      if (!/\b(?:helped|improved|progress|now|more efficient|reduced)\b/i.test(answer)) improvements.push("Add one sign of progress that shows your improvement plan is already working.");
      betterApproach = "State a genuine, manageable weakness → explain its work impact → describe the habit you changed → give one sign of recent progress.";
    } else if (category === "conflict") {
      const conflictContext = /\b(?:disagree|conflict|different opinion|argument|decision)\b/i.test(answer);
      const conflictAction = /\bI\s+(?:listened|compared|explained|proposed|asked|responded|handled|resolved|clarified)\b/i.test(answer);
      const outcomeFollowUp = question.isFollowUp && /\b(?:outcome|eventual|respond)\b/i.test(question.question);
      if (conflictContext && !outcomeFollowUp) whatWentWell.push("You identified the actual disagreement rather than describing teamwork in general.");
      if (conflictAction) whatWentWell.push("You stated a personal response to the disagreement, such as listening, comparing, or explaining options.");
      if (hasOutcome) whatWentWell.push(outcomeFollowUp ? "You answered the follow-up with an outcome from the disagreement." : "You included the result of the conflict-resolution attempt.");
      if (!conflictAction) improvements.push("State exactly how you personally responded to the disagreement, not only what the team discussed.");
      if (!hasOutcome) improvements.push(outcomeFollowUp ? "The follow-up specifically asks for the eventual outcome; state what was decided or changed." : "Complete this conflict example with the decision, relationship impact, or final result.");
      betterApproach = outcomeFollowUp ? "Personal response → final decision/outcome → effect on the team or work → lesson." : "Disagreement and stakes → your responsibility → your response → decision/outcome → lesson.";
    } else if (category === "teamwork") {
      if (/\b(?:team|collaborat|together)\b/i.test(answer)) whatWentWell.push("You established a specific team or collaboration context.");
      if (hasOwnership) whatWentWell.push("You identified work that you personally contributed to the team effort.");
      if (hasOutcome) whatWentWell.push("You connected the contribution to a team result or lesson.");
      if (!hasOwnership) improvements.push("Name the exact task, decision, or deliverable that was personally yours.");
      if (!hasOutcome) improvements.push("Explain how your contribution affected the team result, delivery, or collaboration.");
      betterApproach = "Team goal → your assigned responsibility → your concrete contribution → team outcome → what you learned about collaboration.";
    } else if (category === "leadership") {
      if (/\b(?:led|leadership|ownership|initiative|guided|mentored|coordinated)\b/i.test(answer)) whatWentWell.push("You identified a concrete form of ownership or leadership in the answer.");
      if (hasOwnership) whatWentWell.push("You described a decision or action that you personally drove.");
      if (!hasOutcome) improvements.push("Explain how other people or the final work changed because of your leadership.");
      betterApproach = "Situation requiring ownership → decision you took → how you influenced or supported others → result → leadership lesson.";
    } else if (category === "failure" || category === "challenges") {
      if (/\b(?:failed|failure|mistake|setback|challenge|difficult|problem|obstacle)\b/i.test(answer)) whatWentWell.push(`You identified a specific ${category === "failure" ? "setback" : "challenge"}.`);
      if (hasOwnership) whatWentWell.push("You described an action you personally took in response.");
      if (/\b(?:learned|changed|afterward|since then|prevent)\b/i.test(answer)) whatWentWell.push("You stated a lesson or behavior change supported by the answer.");
      if (!hasOutcome) improvements.push("State what happened after your action and what changed as a result.");
      betterApproach = `${category === "failure" ? "Setback and your responsibility" : "Challenge and constraint"} → action taken → result → specific lesson or later behavior change.`;
    } else if (category === "goals") {
      if (/\b(?:goal|career|role|future|develop|grow|learn)\b/i.test(answer)) whatWentWell.push("You stated a career direction or capability you want to develop.");
      if (!/\b(?:because|so that|impact|reason|motivated)\b/i.test(answer)) improvements.push("Explain why this goal matters and how it connects to the role you are pursuing.");
      betterApproach = "Immediate role goal → capability you want to build → why it matters → concrete next step.";
    } else if (category === "motivation") {
      if (/\b(?:motivat|enjoy|interested|purpose|impact|learn)\b/i.test(answer)) whatWentWell.push("You identified a specific source of motivation.");
      if (!hasExample) improvements.push("Support the motivation with one recent example showing how it changed your effort or choices.");
      betterApproach = "Source of motivation → one real example → behavior it produced → connection to the work you want to do.";
    } else if (category === "fit") {
      const valueEvidence = matchedTerms(answer, ["skills", "experience", "project", "internship", "contribute", "strength"]);
      if (valueEvidence.length) whatWentWell.push(`You connected your case to candidate value such as ${naturalList(valueEvidence.slice(0, 3))}.`);
      if (!hasExample) improvements.push("Support the hiring claim with one concrete project, result, or responsibility that proves the value stated.");
      betterApproach = "Role need → your matching strength → evidence that proves it → specific value you can contribute.";
    } else if (category === "pressure") {
      if (/\b(?:priorit|deadline|schedule|urgent|communicat)\b/i.test(answer)) whatWentWell.push("You named a concrete method for managing competing deadlines or pressure.");
      if (!hasOutcome) improvements.push("Add the result of using that method, including whether deadlines or quality were protected.");
      betterApproach = "Competing demands → prioritization rule → communication and execution → result.";
    } else if (category === "communication") {
      if (/\b(?:explained|listened|clarif|feedback|message|communicat)\b/i.test(answer)) whatWentWell.push("You identified a specific communication action used in the situation.");
      if (!hasOutcome) improvements.push("Explain exactly how that communication changed understanding, a decision, or the final result.");
      betterApproach = "Communication problem → audience and message → what you changed → resulting decision or understanding.";
    }
    if (conciseGuidance) improvements.push(conciseGuidance);
    if (!whatWentWell.length) whatWentWell.push(`The response contained assessable ${question.topic} detail, but no specific demonstrated strength was supported strongly enough for positive credit.`);
    if (!improvements.length) {
      const defaultImprovement = {
        introduction: "Keep the introduction interview-length by prioritizing one strongest proof point instead of expanding every technical detail.",
        strengths: "Make the proof sharper by naming how this strength affected delivery, quality, or another person.",
        weaknesses: "Add how you will monitor whether the new improvement habit continues to work under deadline pressure.",
        teamwork: "Clarify how your individual action changed the team's final result.",
        conflict: "State the exact disagreement, the criterion used to decide, and whether the relationship or outcome improved.",
        leadership: "Name the decision you owned and how others responded to your direction.",
        failure: "Separate the immediate fix from the longer-term behavior you changed afterward.",
        challenges: "Explain which option you rejected and why your chosen response was more suitable.",
        goals: "Connect the goal to one concrete skill or responsibility you want to build next.",
        motivation: "Support the motivation with one recent example of how it changed your behavior.",
        pressure: "Name the prioritization rule you use when two tasks remain equally urgent.",
        communication: "Explain what you changed in the message or channel and how that affected the outcome.",
        fit: "Tie your strongest evidence directly to one responsibility expected in the target role."
      }[category];
      improvements.push(defaultImprovement);
    }
    return { quality, ratings, whatWentWell: unique(whatWentWell).slice(0, 3), improvements: unique(improvements).slice(0, 3), betterApproach };
  }

  const technologyTerms = matchedTerms(answer, unique([...TECHNICAL_EVIDENCE_TERMS, ...session.resumeContext.technologies, ...session.resumeContext.fundamentals, "authentication", "props", "render", "profiler", "memoization", "generator", "lazy evaluation", "classes", "objects", "inheritance", "encapsulation", "hashing", "unique constraint"]));
  const whatWentWell = [];
  const improvements = [];
  let betterApproach;
  if (question.category === "project") {
    const decisionQuestion = /\b(?:decision|alternatives|choose|chose)\b/i.test(question.question);
    const debuggingQuestion = /\b(?:failure|bottleneck|bug|isolate|fix)\b/i.test(question.question);
    const architecture = matchedTerms(answer, ["frontend", "backend", "database", "API", "authentication", "Gemini", "model"]);
    if (architecture.length >= 2) whatWentWell.push(`You explained concrete parts of the system, including ${naturalList(architecture.slice(0, 4))}, instead of describing the project only at a high level.`);
    if (hasOwnership) whatWentWell.push("You distinguished your personal implementation work from the overall project description.");
    if (!hasTradeOff) improvements.push(`For ${question.topic}, compare one important design choice with an alternative and explain why your choice fit the project.`);
    if (decisionQuestion && hasTradeOff) improvements.push("Name the alternatives explicitly and connect the final choice to a concrete constraint such as delivery time, reliability, scale, or maintainability.");
    if (debuggingQuestion && !/\b(?:log|test|reproduce|verify|root cause)\b/i.test(answer)) improvements.push("Describe the evidence that isolated the root cause and the test that proved the bug was fixed.");
    if (!hasOutcome) improvements.push("Add one concrete result—such as reliability, performance, usability, or a verified fix—to show the impact of your work.");
    betterApproach = debuggingQuestion
      ? `For the ${question.topic} debugging question: symptom → reproduction → evidence examined → root cause → fix → regression test.`
      : decisionQuestion
        ? `For the ${question.topic} decision question: constraint → alternatives considered → comparison criteria → chosen option → trade-off accepted → result.`
        : `For ${question.topic}: state the problem → trace one request through the main components → identify exactly what you built → explain one design decision and trade-off → finish with a verified result or lesson.`;
  } else if (question.category === "skill") {
    if (technologyTerms.length) whatWentWell.push(`You connected ${question.topic} to specific ideas from your answer: ${naturalList(technologyTerms.slice(0, 4))}.`);
    if (hasExample) whatWentWell.push(`You gave an application example instead of only defining ${question.topic}.`);
    if (!hasExample) improvements.push(`Add a small ${question.topic} example that demonstrates the behavior you described instead of leaving it only at the explanation level.`);
    if (!hasTradeOff) improvements.push(`Contrast the ${question.topic} approach you described with one alternative and state when your approach would not be the best choice.`);
    betterApproach = `For ${question.topic}: answer the exact concept first → explain how it works → give a small concrete example → compare it with an alternative → state one limitation.`;
  } else if (question.category === "fundamentals") {
    if (technologyTerms.length) whatWentWell.push(`You used concrete technical concepts—${naturalList(technologyTerms.slice(0, 4))}—rather than relying on vague terminology.`);
    if (hasTradeOff) whatWentWell.push("You discussed a cost or trade-off, which shows reasoning beyond a memorized definition.");
    if (!hasTradeOff) improvements.push(`Make the ${question.topic} answer interview-ready by comparing at least two choices and stating their time, space, or operational cost where relevant.`);
    if (hasTradeOff && hasExample) improvements.push(`State one assumption or edge case that could change the ${question.topic} conclusion you gave.`);
    betterApproach = `Start with the decision required by the question → name the relevant ${question.topic} concept → reason through the example step by step → quantify cost or complexity → mention the main trade-off.`;
  } else {
    const steps = matchedTerms(answer, ["requirements", "input", "output", "constraints", "edge cases", "alternatives", "time complexity", "space", "prototype", "test"]);
    if (steps.length >= 2) whatWentWell.push(`Your process includes concrete diagnostic steps: ${naturalList(steps.slice(0, 5))}.`);
    if (hasStructure) whatWentWell.push("You presented the reasoning as an ordered process rather than jumping directly to implementation.");
    if (!/\b(?:measure|metric|log|reproduce|verify|test)\b/i.test(answer)) improvements.push("Name the evidence or measurement you would use to verify that the chosen solution actually fixed the problem.");
    else improvements.push("Name the exact log, metric, or test assertion you would use so the verification step is measurable rather than implied.");
    betterApproach = "Clarify the expected behavior → reproduce with evidence → narrow the failing component → compare solutions against constraints → implement the smallest safe change → verify with a measurable test.";
  }
  if (conciseGuidance) improvements.push(conciseGuidance);
  if (!whatWentWell.length) whatWentWell.push(`The answer contained identifiable technical evidence (${naturalList(technologyTerms.slice(0, 3))}), but no specific demonstrated strength was supported strongly enough for positive credit.`);
  if (!improvements.length) improvements.push(`Your ${question.topic} answer is strong; make it sharper by stating the key decision in the first sentence and keeping supporting details focused on that decision.`);
  return { quality, ratings, whatWentWell: unique(whatWentWell).slice(0, 3), improvements: unique(improvements).slice(0, 3), betterApproach };
};

const groundingTokens = (value) => String(value || "").toLowerCase().match(/[a-z0-9+#.]{4,}/g)?.filter((token) => !new Set(["about", "describe", "explain", "project", "application", "system", "resume", "technology", "using", "your", "that", "this", "with", "from", "were", "what", "when", "where", "which"]).has(token)) || [];
const questionGrounded = (question, session, currentAnswer = "") => {
  if (session.type === "hr") return true;
  const allowed = unique([...session.resumeContext.technologies, ...session.resumeContext.fundamentals]);
  const knownTechInQuestion = TECHNOLOGY_CATALOG.filter((technology) => containsTerm(question.question, technology));
  if (!knownTechInQuestion.every((technology) => allowed.some((item) => item.toLowerCase() === technology.toLowerCase()) || containsTerm(currentAnswer, technology))) return false;
  if (/\b(?:you mentioned|in your previous answer)\b/i.test(question.question) && knownTechInQuestion.some((technology) => !containsTerm(currentAnswer, technology))) return false;
  if (question.category !== "project") return true;
  const answerHasProjectEvidence = /\b(?:project|application|platform|portal|system|website|service|API)\b/i.test(currentAnswer) && matchedTerms(currentAnswer, unique([...TECHNICAL_EVIDENCE_TERMS, ...session.resumeContext.technologies])).length > 0;
  if (!session.resumeContext.projects.length && !answerHasProjectEvidence) return false;
  if (/\b(?:one of your projects|a project (?:from|on) your resume|the project you (?:mentioned|described)|that project|this project)\b/i.test(question.question)) return true;
  const evidenceTokens = new Set(groundingTokens([...session.resumeContext.projects, currentAnswer].join(" ")));
  return groundingTokens(question.question).some((token) => evidenceTokens.has(token));
};
const questionNatural = (question) => !/^(?:you list .+explain one important concept|explain a core .+concept that is important)/i.test(question.question);
const normalizeAiRatings = (value, type) => {
  const source = value?.ratings;
  if (!source || typeof source !== "object") return null;
  const ratings = {};
  for (const dimension of DIMENSIONS[type]) {
    const rating = Number(source[dimension]);
    if (!Number.isInteger(rating) || rating < 0 || rating > 4) return null;
    ratings[dimension] = rating;
  }
  return ratings;
};

const buildTurnPrompt = (session, answer) => {
  const recent = session.turns.slice(-4).map(({ question, answer: previousAnswer }) => ({ question, answer: previousAnswer }));
  const promptContext = session.type === "technical" ? session.resumeContext : { interviewType: "HR" };
  return `You are conducting a realistic text-only ${session.type === "hr" ? "HR behavioral" : "technical"} mock interview. Evaluate CURRENT_ANSWER using the 0-4 rubric: 0 absent/incorrect, 1 weak, 2 developing, 3 good, 4 strong. Use only the candidate's actual words and verified context. Never invent experience, projects, technologies, employers, achievements, or metrics. Return JSON with evaluation ratings keyed exactly by the supplied dimensions and one nextQuestion (question, category, topic, isFollowUp). Ask a specific question an interviewer would naturally say aloud. Never repeat or lightly paraphrase an asked question. When referencing a resume-only skill, say that it appears in the resume; say "you mentioned" only when it occurs in the candidate's answer. Avoid prompts such as "explain one important concept" or "explain a core concept." Do not include feedback in the question. Maintain breadth using COVERAGE.\nDIMENSIONS\n${JSON.stringify(DIMENSIONS[session.type])}\nALLOWED_CATEGORIES\n${JSON.stringify([...QUESTION_CATEGORIES[session.type]])}\nVERIFIED_CONTEXT\n${JSON.stringify(promptContext)}\nCOVERAGE\n${JSON.stringify(session.coverage)}\nASKED_QUESTIONS\n${JSON.stringify(askedQuestions(session))}\nRECENT_CONVERSATION\n${JSON.stringify(recent)}\nCURRENT_QUESTION\n${JSON.stringify(session.currentQuestion)}\nCURRENT_ANSWER\n${JSON.stringify(answer)}\nQUESTIONS_REMAINING_AFTER_THIS_ANSWER\n${session.questionLimit - session.turns.length - 1}`;
};

const generateTurn = async (session, answer, options = {}) => {
  const evidenceEvaluation = fallbackEvaluation(session, answer);
  const fallback = { evaluation: evidenceEvaluation, nextQuestion: fallbackQuestion(session, answer) };
  try {
    const generate = options.generateTurn || geminiService.generateMockInterviewTurn;
    const raw = await generate(buildTurnPrompt(session, answer), { requestId: options.requestId });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const aiRatings = normalizeAiRatings(parsed.evaluation, session.type);
    const evaluation = aiRatings && evidenceEvaluation.quality === ANSWER_QUALITY.SUBSTANTIVE ? { ...evidenceEvaluation, ratings: aiRatings } : evidenceEvaluation;
    if (session.turns.length + 1 >= session.questionLimit) return { evaluation, nextQuestion: null };
    const nextQuestion = normalizeQuestion(parsed.nextQuestion, session.type);
    const categoryLimit = session.questionLimit === 5 ? 2 : 3;
    if (!nextQuestion || coverageCount(session, nextQuestion.category) >= categoryLimit || questionRepeated(nextQuestion.question, session) || !questionNatural(nextQuestion) || !questionGrounded(nextQuestion, session, answer)) return { evaluation, nextQuestion: fallback.nextQuestion };
    return { evaluation, nextQuestion };
  } catch (error) {
    console.warn("Mock interview turn generation failed; using fallback.", { interviewId: session.id, message: error.message });
    return fallback;
  }
};

const firstQuestion = (session) => session.type === "hr"
  ? { question: HR_FALLBACKS.introduction, category: "introduction", topic: "introduction", isFollowUp: false }
  : fallbackQuestion(session);

const labelFor = (score) => score >= 90 ? "Excellent" : score >= 75 ? "Strong" : score >= 60 ? "Good" : score >= 40 ? "Developing" : "Needs Improvement";
const priorityFor = (dimension, type) => {
  const map = type === "hr" ? {
    "Answer Relevance": "Answer the exact question first, then add only supporting context.", Clarity: "Use shorter sentences and make the main point explicit.", "Response Structure": "Practice situation → action → result → learning structure.", Professionalism: "Use professional, accountable language even when discussing setbacks.", "Communication Quality": "Remove repetition and connect ideas with a clear narrative.", Assertiveness: "State your contribution and decisions directly without exaggeration."
  } : {
    "Technical Knowledge": "Revise the weakest concepts revealed by these interview questions.", "Concept Clarity": "Define the core concept before adding examples or implementation details.", "Answer Accuracy": "Verify definitions, assumptions, and technical claims before your next interview.", "Problem Solving": "Explain constraints, alternatives, and trade-offs before choosing a solution.", "Explanation Quality": "Practice concise concept → reasoning → example explanations.", "Resume Knowledge": "Prepare deeper explanations for every project and technology listed on your resume."
  };
  return map[dimension];
};

const buildReport = (session) => {
  const dimensions = DIMENSIONS[session.type].map((dimension) => {
    const average = session.turns.reduce((sum, turn) => sum + turn.evaluation.ratings[dimension], 0) / session.turns.length;
    return { dimension, score: Math.round(average * 25) };
  });
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const ranked = [...dimensions].sort((a, b) => b.score - a.score);
  const scoredTurns = session.turns.map((turn) => ({ turn, score: Object.values(turn.evaluation.ratings).reduce((sum, rating) => sum + rating, 0) / DIMENSIONS[session.type].length })).sort((a, b) => a.score - b.score);
  const demonstratedTurns = scoredTurns.filter(({ turn, score }) => turn.evaluation.quality === ANSWER_QUALITY.SUBSTANTIVE && score >= 2.5);
  const positive = unique(demonstratedTurns.flatMap(({ turn }) => turn.evaluation.whatWentWell)).slice(0, 4);
  if (!positive.length) positive.push(session.type === "technical" ? "No strong technical areas could be reliably demonstrated from the submitted answers." : "No clear behavioral strengths could be reliably demonstrated from the submitted answers.");
  const insufficientCount = session.turns.filter((turn) => turn.evaluation.quality === ANSWER_QUALITY.INSUFFICIENT).length;
  const mostlyInsufficient = insufficientCount >= Math.ceil(session.turns.length / 2);
  const improvements = mostlyInsufficient
    ? [
      "Provide complete answers instead of acknowledgement-only or non-responsive answers.",
      session.type === "technical" ? "Explain the relevant technical concept and your reasoning rather than only naming or acknowledging the topic." : "Provide specific behavioral evidence that shows your situation, personal action, and result where relevant.",
      session.type === "technical" ? "Support answers with an example, complexity, trade-off, or verification step when the question requires it." : "Tailor each response to the competency being tested instead of giving a generic response."
    ]
    : unique(session.turns.flatMap((turn) => turn.evaluation.improvements)).slice(0, 5);
  const priorityTopics = new Set();
  const topPriorities = mostlyInsufficient ? [...improvements] : [];
  if (!mostlyInsufficient) {
    for (const { turn } of scoredTurns) {
      const topic = turn.question.topic;
      if (priorityTopics.has(topic)) continue;
      priorityTopics.add(topic);
      const item = turn.evaluation.improvements[0];
      const detail = item.replace(/^For [^,]+,\s*/i, "");
      topPriorities.push(session.type === "technical" ? `${topic}: ${detail}` : item);
      if (topPriorities.length >= 3) break;
    }
  }
  for (const item of [...dimensions].sort((a, b) => a.score - b.score)) {
    if (topPriorities.length >= 3) break;
    const priority = priorityFor(item.dimension, session.type);
    if (!topPriorities.includes(priority)) topPriorities.push(priority);
  }
  const strongestTurn = [...scoredTurns].sort((a, b) => b.score - a.score)[0].turn;
  const weakestTurn = scoredTurns[0].turn;
  const weakestImprovement = weakestTurn.evaluation.improvements[0].replace(/^Your .+? answer is strong;\s*/i, "").replace(/^For [^,]+,\s*/i, "");
  const assessment = mostlyInsufficient
    ? session.type === "technical" ? "Most submitted answers did not contain enough technical evidence to assess knowledge reliably." : "Most submitted answers did not contain enough behavioral evidence to assess interview competencies reliably."
    : session.type === "technical"
      ? `Your strongest evidence came from the ${strongestTurn.question.topic} answer. For ${weakestTurn.question.topic}, focus next on ${weakestImprovement.charAt(0).toLowerCase()}${weakestImprovement.slice(1)}`
      : `Your strongest response addressed ${strongestTurn.question.topic}. The clearest next improvement is: ${weakestTurn.evaluation.improvements[0]}`;
  return {
    contractVersion: INTERVIEW_VERSION,
    interviewType: session.type,
    targetRole: session.targetRole || null,
    overallScore,
    scoreLabel: labelFor(overallScore),
    dimensionScores: dimensions,
    strengths: positive,
    improvementAreas: improvements,
    questionFeedback: session.turns.map((turn, index) => ({ questionNumber: index + 1, question: turn.question.question, answer: turn.answer, score: Math.round(Object.values(turn.evaluation.ratings).reduce((a, b) => a + b, 0) / Object.values(turn.evaluation.ratings).length * 2.5), whatWentWell: turn.evaluation.whatWentWell, improvements: turn.evaluation.improvements, betterApproach: turn.evaluation.betterApproach })),
    verdict: { currentLevel: labelFor(overallScore), assessment: mostlyInsufficient ? assessment : `${assessment} Overall, your strongest scoring dimension was ${ranked[0].dimension.toLowerCase()}, while ${ranked.at(-1).dimension.toLowerCase()} was the lowest.` },
    topPriorities
  };
};

const startInterview = ({ type, questionLimit, targetRole, resumeText }) => {
  cleanupExpiredSessions();
  const validation = validateSetup({ type, questionLimit, targetRole });
  if (!validation.valid) throw Object.assign(new Error(validation.errors[0]), { code: "INVALID_SETUP", status: 400 });
  if (type === "technical" && (!resumeText || resumeText.length < 80)) throw Object.assign(new Error("A readable resume is required for a technical interview."), { code: "RESUME_REQUIRED", status: 422 });
  const session = { id: randomUUID(), type, questionLimit: Number(questionLimit), targetRole: type === "technical" ? targetRole : null, resumeContext: type === "technical" ? extractTechnicalContext(resumeText, targetRole) : null, coverage: {}, turns: [], currentQuestion: null, createdAt: now(), expiresAt: now() + SESSION_TTL_MS, status: "active", pending: false };
  session.currentQuestion = firstQuestion(session);
  session.coverage[session.currentQuestion.category] = 1;
  sessions.set(session.id, session);
  return { interviewId: session.id, type: session.type, targetRole: session.targetRole, questionLimit: session.questionLimit, questionNumber: 1, question: session.currentQuestion.question };
};

const submitAnswer = async (interviewId, answerValue, options = {}) => {
  cleanupExpiredSessions();
  const session = sessions.get(interviewId);
  if (!session || session.expiresAt <= now()) throw Object.assign(new Error("This interview session has expired. Start another interview."), { code: "SESSION_NOT_FOUND", status: 404 });
  if (session.status !== "active") throw Object.assign(new Error("This interview is already complete."), { code: "INTERVIEW_COMPLETE", status: 409 });
  if (session.pending) throw Object.assign(new Error("The previous answer is still being processed."), { code: "ANSWER_IN_PROGRESS", status: 409 });
  const answer = cleanText(answerValue, 4000);
  if (answer.length < 2) throw Object.assign(new Error("Type an answer before submitting."), { code: "ANSWER_REQUIRED", status: 400 });
  session.pending = true;
  try {
    const generated = await generateTurn(session, answer, options);
    session.turns.push({ question: session.currentQuestion, answer, evaluation: generated.evaluation });
    session.expiresAt = now() + SESSION_TTL_MS;
    if (session.turns.length >= session.questionLimit) {
      session.status = "complete";
      const report = buildReport(session);
      return { complete: true, answeredQuestions: session.turns.length, report };
    }
    session.currentQuestion = generated.nextQuestion || fallbackQuestion(session, answer);
    session.coverage[session.currentQuestion.category] = coverageCount(session, session.currentQuestion.category) + 1;
    return { complete: false, questionNumber: session.turns.length + 1, questionLimit: session.questionLimit, question: session.currentQuestion.question };
  } finally { session.pending = false; }
};

const resetSessionsForTests = () => sessions.clear();
module.exports = { startInterview, submitAnswer, extractTechnicalContext, buildReport, resetSessionsForTests, _sessions: sessions };
