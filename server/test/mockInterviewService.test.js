"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("../services/mockInterviewService");

const failGemini = async () => { throw new Error("Gemini unavailable"); };
const technicalResume = [
  "Student Candidate", "candidate@example.com | +91 9876543210", "EDUCATION", "B.Tech Computer Science",
  "TECHNICAL SKILLS", "Java, React, PostgreSQL", "PROJECTS", "AI Placement Mentor | 2026",
  "Built a React application with an Express backend and PostgreSQL persistence.", "Campus Portal | 2025",
  "Developed a responsive student portal using JavaScript and React."
].join("\n");

test.beforeEach(() => service.resetSessionsForTests());

test("HR interview enforces exactly five answer turns and returns a grounded report", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 5 });
  assert.equal(started.questionNumber, 1);
  assert.equal(started.question, "Tell me about yourself.");
  const answers = [
    "I am a computer science student who enjoys building projects and learning from team experiences.",
    "In one team project I organized tasks, implemented my part, and helped resolve integration issues.",
    "A disagreement emerged about implementation, so I compared options and helped the team choose a supported approach.",
    "I learned to communicate assumptions earlier and document important decisions for everyone.",
    "My goal is to contribute reliably in an entry-level role while deepening my engineering judgment."
  ];
  let result;
  for (let index = 0; index < answers.length; index += 1) {
    result = await service.submitAnswer(started.interviewId, answers[index], { generateTurn: failGemini });
    assert.equal(result.complete, index === answers.length - 1);
  }
  assert.equal(result.report.questionFeedback.length, 5);
  assert.deepEqual(result.report.questionFeedback.map((item) => item.answer), answers);
  assert.ok(new Set(result.report.questionFeedback.map((item) => item.betterApproach)).size >= 3);
  assert.equal(result.report.questionFeedback.some((item) => item.whatWentWell.includes("The answer includes a concrete point or example from the candidate's response.")), false);
  await assert.rejects(() => service.submitAnswer(started.interviewId, "extra", { generateTurn: failGemini }), (error) => error.code === "INTERVIEW_COMPLETE");
});

test("HR fallback asks an answer-aware behavioral follow-up", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 5 });
  const next = await service.submitAnswer(started.interviewId, "During a team project we had a conflict because we disagreed about the implementation.", { generateTurn: failGemini });
  assert.match(next.question, /disagreement|outcome/i);
  const afterFollowUp = await service.submitAnswer(started.interviewId, "I addressed the same conflict by comparing the options and helping the team reach an outcome.", { generateTurn: failGemini });
  assert.notEqual(afterFollowUp.question, next.question);
});

test("technical context is grounded in resume projects, skills, and selected role", () => {
  const context = service.extractTechnicalContext(technicalResume, "Software Development Engineer (SDE)");
  assert.ok(context.technologies.includes("Java"));
  assert.ok(context.technologies.includes("React"));
  assert.ok(context.technologies.includes("PostgreSQL"));
  assert.equal(JSON.stringify(context).includes("Docker"), false);
  assert.ok(context.fundamentals.includes("DBMS"));
});

test("technical project names remove collapsed subtitles and date ranges", () => {
  const resume = ["Candidate", "EDUCATION", "B.Tech", "SKILLS", "Python", "PROJECTS", "AIPlacementMentor—Full-StackAIWebApplication | May2026–Jul2026", "Built the frontend and backend with Python for placement preparation."].join("\n");
  const context = service.extractTechnicalContext(resume, "Software Development Engineer (SDE)");
  assert.equal(context.projects[0], "AI Placement Mentor");
});

test("ten-question technical fallback maintains category breadth", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 10, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  let result;
  for (let index = 0; index < 10; index += 1) result = await service.submitAnswer(started.interviewId, `I would explain the concept with a supported project example, assumptions, implementation reasoning, trade-offs, and outcome ${index}.`, { generateTurn: failGemini });
  const session = service._sessions.get(started.interviewId);
  const categories = session.turns.map((turn) => turn.question.category);
  assert.equal(result.complete, true);
  assert.ok(new Set(categories).size >= 4, categories);
  assert.ok(Math.max(...Object.values(categories.reduce((counts, category) => ({ ...counts, [category]: (counts[category] || 0) + 1 }), {}))) <= 3);
  assert.equal(JSON.stringify(session.turns.map((turn) => turn.question)).includes("Docker"), false);
  assert.equal(new Set(session.turns.map((turn) => turn.question.question)).size, 10);
  assert.equal(session.turns.some((turn) => /explain (?:one important|a core).*concept/i.test(turn.question.question)), false);
});

test("technical fallback asks concrete questions and produces answer-specific report feedback", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  const answers = [
    "The frontend uses React, the Express API handles requests, and PostgreSQL stores data. I built the API integration and verified the completed flow.",
    "An interface defines a contract while an abstract class can share state and implementation. I would use the interface when unrelated classes need the same behavior.",
    "I would use a HashMap to detect duplicates in O(n) average time with O(n) extra space, trading memory for speed.",
    "I would reproduce the duplicate request, inspect logs, isolate the race, use a unique constraint and transaction, then test concurrent requests.",
    "For Campus Portal, I compared client and server rendering, chose the simpler supported flow, and measured the result before release."
  ];
  let result;
  for (const answer of answers) result = await service.submitAnswer(started.interviewId, answer, { generateTurn: failGemini });
  const feedback = result.report.questionFeedback;
  assert.equal(new Set(feedback.map((item) => item.question)).size, 5);
  assert.equal(feedback.some((item) => /explain (?:one important|a core).*concept/i.test(item.question)), false);
  assert.ok(feedback[0].whatWentWell.some((item) => /React|Express|PostgreSQL|frontend|backend|database/i.test(item)));
  assert.ok(new Set(feedback.map((item) => item.betterApproach)).size >= 4);
  assert.ok(new Set(feedback.flatMap((item) => item.improvements)).size >= 4);
  assert.ok(result.report.topPriorities.some((item) => /AI Placement Mentor|Java|DSA|diagnostic|Campus Portal/i.test(item)));
});

test("Gemini failure preserves answers and returns a valid next question", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Frontend Developer", resumeText: technicalResume });
  const result = await service.submitAnswer(started.interviewId, "React uses component state to represent changing interface data, and I used it in my portal project.", { generateTurn: failGemini });
  assert.equal(result.complete, false);
  assert.ok(result.question);
  assert.equal(service._sessions.get(started.interviewId).turns[0].answer.includes("component state"), true);
});

test("technical skill attribution distinguishes resume evidence from the previous answer", async () => {
  const pythonResume = technicalResume.replace("Java, React, PostgreSQL", "Python");
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: pythonResume });
  const fromResume = await service.submitAnswer(started.interviewId, "I designed the project as a browser client, an API, and a database.", { generateTurn: failGemini });
  assert.match(fromResume.question, /Python appears in your resume/i);
  assert.doesNotMatch(fromResume.question, /you mentioned Python/i);
});

test("an AI-generated project question is rejected when the project is absent from the resume and answer", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Frontend Developer", resumeText: technicalResume });
  const generated = async () => ({
    evaluation: {
      ratings: { "Technical Knowledge": 3, "Concept Clarity": 3, "Answer Accuracy": 3, "Problem Solving": 3, "Explanation Quality": 3, "Resume Knowledge": 3 },
      whatWentWell: ["The answer addresses the question."],
      improvements: ["Explain the trade-off more explicitly."],
      betterApproach: "State the concept, reasoning, and supported example."
    },
    nextQuestion: { question: "Explain the architecture of your Inventory Management System project.", category: "project", topic: "Inventory Management System", isFollowUp: false }
  });
  const result = await service.submitAnswer(started.interviewId, "I built the AI Placement Mentor with React and explained its component structure.", { generateTurn: generated });
  assert.doesNotMatch(result.question, /Inventory Management System/i);
});

test("an AI-generated repeated question is replaced with a new covered topic", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 5 });
  const generated = async () => ({
    evaluation: { ratings: { "Answer Relevance": 3, Clarity: 3, "Response Structure": 3, Professionalism: 3, "Communication Quality": 3, Assertiveness: 3 } },
    nextQuestion: { question: "Tell me about yourself and your background.", category: "introduction", topic: "introduction", isFollowUp: false }
  });
  const result = await service.submitAnswer(started.interviewId, "I am a computer science student focused on software projects.", { generateTurn: generated });
  assert.doesNotMatch(result.question, /tell me about yourself/i);
});

test("AI cannot claim a resume skill was mentioned in the previous answer when it was not", async () => {
  const pythonResume = technicalResume.replace("Java, React, PostgreSQL", "Python");
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: pythonResume });
  const generated = async () => ({
    evaluation: { ratings: { "Technical Knowledge": 3, "Concept Clarity": 3, "Answer Accuracy": 3, "Problem Solving": 3, "Explanation Quality": 3, "Resume Knowledge": 3 } },
    nextQuestion: { question: "You mentioned Python in your previous answer. When would you use a generator?", category: "skill", topic: "Python", isFollowUp: true }
  });
  const result = await service.submitAnswer(started.interviewId, "I described the browser, API, and database layers.", { generateTurn: generated });
  assert.match(result.question, /Python appears in your resume/i);
});

test("five technical acknowledgement-only answers score zero without invented strengths", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  let result;
  for (let index = 0; index < 5; index += 1) result = await service.submitAnswer(started.interviewId, "ok", { generateTurn: failGemini });
  assert.equal(result.report.overallScore, 0);
  assert.deepEqual(result.report.dimensionScores.map((item) => item.score), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.report.strengths, ["No strong technical areas could be reliably demonstrated from the submitted answers."]);
  assert.equal(JSON.stringify(result.report).includes("provided enough detail"), false);
  for (const item of result.report.questionFeedback) {
    assert.equal(item.score, 0);
    assert.match(item.whatWentWell[0], /No assessable technical evidence/i);
    assert.match(item.improvements[0], /insufficient/i);
  }
  assert.match(result.report.verdict.assessment, /did not contain enough technical evidence/i);
});

test("partial hash answer receives limited credit and names the missing explanation and complexity", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  const session = service._sessions.get(started.interviewId);
  session.currentQuestion = { question: "Suppose you need to detect duplicate values in a large array. Which data structure would you use, and what are its time and space costs?", category: "fundamentals", topic: "DSA", isFollowUp: false };
  await service.submitAnswer(started.interviewId, "hashmap", { generateTurn: failGemini });
  const evaluation = session.turns[0].evaluation;
  const score = Math.round(Object.values(evaluation.ratings).reduce((sum, value) => sum + value, 0) / 6 * 2.5);
  assert.equal(evaluation.quality, "PARTIAL");
  assert.ok(score > 0 && score <= 3);
  assert.match(evaluation.whatWentWell[0], /hash-based data structure/i);
  assert.match(evaluation.improvements[0], /time and space complexity/i);
});

test("substantive hash answer scores higher and credits demonstrated concepts", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  const session = service._sessions.get(started.interviewId);
  session.currentQuestion = { question: "Suppose you need to detect duplicate values in a large array. Which data structure would you use, and what are its time and space costs?", category: "fundamentals", topic: "DSA", isFollowUp: false };
  await service.submitAnswer(started.interviewId, "I would traverse the array using a HashSet. For every element, I check whether it already exists in the set. If it does, it is a duplicate; otherwise I insert it. Average time complexity is O(n), with O(n) extra space.", { generateTurn: failGemini });
  const evaluation = session.turns[0].evaluation;
  const score = Math.round(Object.values(evaluation.ratings).reduce((sum, value) => sum + value, 0) / 6 * 2.5);
  assert.equal(evaluation.quality, "SUBSTANTIVE");
  assert.ok(score >= 6);
  assert.ok(evaluation.whatWentWell.some((item) => /HashSet|array|time complexity|space complexity/i.test(item)));
});

test("long non-answers and technically unrelated answers fail the minimum evidence gate", async () => {
  const pythonResume = technicalResume.replace("Java, React, PostgreSQL", "Python");
  const denied = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: pythonResume });
  const deniedSession = service._sessions.get(denied.interviewId);
  deniedSession.currentQuestion = { question: "Python appears in your resume. When would you use a generator instead of returning a list?", category: "skill", topic: "Python", isFollowUp: false };
  await service.submitAnswer(denied.interviewId, "I don't know how to answer this question, sorry.", { generateTurn: failGemini });
  assert.equal(deniedSession.turns[0].evaluation.quality, "INSUFFICIENT");
  assert.deepEqual(Object.values(deniedSession.turns[0].evaluation.ratings), [0, 0, 0, 0, 0, 0]);

  const unrelated = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: pythonResume });
  const unrelatedSession = service._sessions.get(unrelated.interviewId);
  unrelatedSession.currentQuestion = { question: "Python appears in your resume. When would you use a generator instead of returning a list?", category: "skill", topic: "Python", isFollowUp: false };
  await service.submitAnswer(unrelated.interviewId, "hashmap", { generateTurn: failGemini });
  assert.equal(unrelatedSession.turns[0].evaluation.quality, "INSUFFICIENT");
});

test("descriptive resume prose cannot become a project anchor", () => {
  const resume = [
    "Student Candidate", "candidate@example.com", "EDUCATION", "B.Tech Computer Science", "TECHNICAL SKILLS", "Python",
    "PROJECTS", "guidance from student profiles and resumes.", "helps users improve through personalized recommendations.",
    "Additional technical coursework in algorithms and databases."
  ].join("\n");
  const context = service.extractTechnicalContext(resume, "Software Development Engineer (SDE)");
  assert.deepEqual(context.projects, []);
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: resume });
  assert.doesNotMatch(started.question, /guidance from student profiles|helps users improve|personalized recommendations/i);
});

test("a validated project header remains available as a project anchor", () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  assert.match(started.question, /AI Placement Mentor/i);
});

test("five HR acknowledgement-only answers score zero without invented behavioral strengths", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 5 });
  let result;
  for (let index = 0; index < 5; index += 1) result = await service.submitAnswer(started.interviewId, "ok", { generateTurn: failGemini });
  assert.equal(result.report.overallScore, 0);
  assert.deepEqual(result.report.strengths, ["No clear behavioral strengths could be reliably demonstrated from the submitted answers."]);
  for (const item of result.report.questionFeedback) {
    assert.equal(item.score, 0);
    assert.match(item.whatWentWell[0], /No assessable behavioral evidence/i);
  }
});

test("HR evaluation uses distinct evidence for introduction, weakness, conflict, and fit questions", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 10 });
  const session = service._sessions.get(started.interviewId);
  const cases = [
    [{ question: "Tell me about yourself.", category: "introduction", topic: "introduction", isFollowUp: false }, "I am a final-year computer science student. I built a placement project, completed a backend internship, and I am seeking a software engineering role."],
    [{ question: "What is your greatest weakness?", category: "weaknesses", topic: "weaknesses", isFollowUp: false }, "I sometimes over-polish small details. I now set priorities and deadlines, and this habit has helped me complete important work more efficiently."],
    [{ question: "Describe a disagreement in a team and how you handled it.", category: "conflict", topic: "conflict handling", isFollowUp: false }, "My team disagreed about the implementation. I listened to both options, compared them against our deadline, and proposed the simpler approach. We agreed and completed integration."],
    [{ question: "Why should we hire you?", category: "fit", topic: "fit", isFollowUp: false }, "My project and internship experience match the role. I built backend APIs and can contribute practical implementation skills while continuing to learn." ]
  ];
  for (const [question, answer] of cases) {
    session.currentQuestion = question;
    await service.submitAnswer(started.interviewId, answer, { generateTurn: failGemini });
  }
  const evaluations = session.turns.map((turn) => turn.evaluation);
  assert.equal(new Set(evaluations.map((item) => item.betterApproach)).size, 4);
  assert.match(evaluations[0].whatWentWell.join(" "), /background|student|project|internship/i);
  assert.match(evaluations[1].whatWentWell.join(" "), /steps|improve/i);
  assert.match(evaluations[2].whatWentWell.join(" "), /disagreement|response|result/i);
  assert.match(evaluations[3].whatWentWell.join(" "), /candidate value|skills|experience|project/i);
});

test("conflict question and outcome follow-up are evaluated independently", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 10 });
  const session = service._sessions.get(started.interviewId);
  session.currentQuestion = { question: "Describe a disagreement in a team and how you handled it.", category: "conflict", topic: "conflict handling", isFollowUp: false };
  await service.submitAnswer(started.interviewId, "The team disagreed about two implementations. I listened to both options, compared them against our requirements, and proposed a decision framework.", { generateTurn: failGemini });
  session.currentQuestion = { question: "How did you respond to that disagreement, and what was the eventual outcome?", category: "conflict", topic: "conflict handling", isFollowUp: true };
  await service.submitAnswer(started.interviewId, "I proposed the simpler option and documented the reasoning. The team agreed, completed the integration on time, and used the same decision process later.", { generateTurn: failGemini });
  const [first, followUp] = session.turns.map((turn) => turn.evaluation);
  assert.match(first.improvements.join(" "), /outcome|final result/i);
  assert.match(followUp.whatWentWell.join(" "), /outcome/i);
  assert.notDeepEqual(first.whatWentWell, followUp.whatWentWell);
  assert.notEqual(first.betterApproach, followUp.betterApproach);
});

test("mixed interview aggregates one substantive, one partial, and three insufficient answers honestly", async () => {
  const started = service.startInterview({ type: "technical", questionLimit: 5, targetRole: "Software Development Engineer (SDE)", resumeText: technicalResume });
  const session = service._sessions.get(started.interviewId);
  await service.submitAnswer(started.interviewId, "AI Placement Mentor uses a React frontend, an Express API, and a PostgreSQL database. I built the integration because the API boundary kept the layers maintainable and testable.", { generateTurn: failGemini });
  session.currentQuestion = { question: "Suppose you need to detect duplicate values in a large array. Which data structure would you use, and what are its time and space costs?", category: "fundamentals", topic: "DSA", isFollowUp: false };
  await service.submitAnswer(started.interviewId, "hashmap", { generateTurn: failGemini });
  for (let index = 0; index < 3; index += 1) await service.submitAnswer(started.interviewId, "ok", { generateTurn: failGemini });
  const report = service.buildReport(session);
  assert.deepEqual(session.turns.map((turn) => turn.evaluation.quality), ["SUBSTANTIVE", "PARTIAL", "INSUFFICIENT", "INSUFFICIENT", "INSUFFICIENT"]);
  assert.ok(report.overallScore < 40);
  assert.ok(report.strengths.length <= 2);
  assert.match(report.topPriorities[0], /complete answers/i);
});

test("duplicate concurrent answer submissions are rejected", async () => {
  const started = service.startInterview({ type: "hr", questionLimit: 5 });
  let release;
  const waitingGenerator = () => new Promise((resolve) => { release = resolve; });
  const first = service.submitAnswer(started.interviewId, "I am a student with project experience and clear learning goals.", { generateTurn: waitingGenerator });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(() => service.submitAnswer(started.interviewId, "duplicate"), (error) => error.code === "ANSWER_IN_PROGRESS");
  release("invalid");
  await first;
  assert.equal(service._sessions.get(started.interviewId).turns.length, 1);
});

test("invalid modes, lengths, roles, and missing technical resumes are rejected", () => {
  for (const setup of [
    { type: "voice", questionLimit: 5 },
    { type: "hr", questionLimit: 7 },
    { type: "technical", questionLimit: 5, targetRole: "Unknown", resumeText: technicalResume },
    { type: "technical", questionLimit: 5, targetRole: "ML Engineer" }
  ]) assert.throws(() => service.startInterview(setup), (error) => ["INVALID_SETUP", "RESUME_REQUIRED"].includes(error.code));
});
