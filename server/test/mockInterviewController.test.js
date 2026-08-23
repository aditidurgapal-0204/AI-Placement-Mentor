"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const servicePath = require.resolve("../services/mockInterviewService");
const extractorPath = require.resolve("../services/publicPdfTextExtractor");
const controllerPath = require.resolve("../controllers/mockInterviewController");

const load = () => {
  require.cache[extractorPath] = { id: extractorPath, filename: extractorPath, loaded: true, exports: { extractPdfTextFromBuffer: async () => "EDUCATION\nB.Tech\nSKILLS\nJava React PostgreSQL\nPROJECTS\nMentor Project\nBuilt a substantial application using supported technologies and clear implementation details." } };
  require.cache[servicePath] = { id: servicePath, filename: servicePath, loaded: true, exports: {
    startInterview: (setup) => ({ interviewId: "public-interview", type: setup.type, targetRole: setup.targetRole || null, questionLimit: setup.questionLimit, questionNumber: 1, question: "First public question?" }),
    submitAnswer: async (_id, answer) => ({ complete: false, questionNumber: 2, questionLimit: 5, question: `Follow-up for ${answer}?` })
  } };
  delete require.cache[controllerPath];
  return require(controllerPath);
};
const response = () => { const result = {}; result.api = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return body; } }; return result; };

test("HR start and answer controllers require no authenticated user", async () => {
  const controller = load();
  const start = response();
  await controller.startInterview({ body: { type: "hr", questionLimit: "5" }, get: () => "request" }, start.api);
  assert.equal(start.status, 201);
  assert.equal(start.body.interview.interviewId, "public-interview");
  const answer = response();
  await controller.answerQuestion({ params: { interviewId: "public-interview" }, body: { answer: "My answer" }, get: () => "request" }, answer.api);
  assert.equal(answer.status, 200);
  assert.match(answer.body.question, /My answer/);
});

test("technical setup validates required resume and PDF signature", async () => {
  const controller = load();
  const missing = response();
  await controller.startInterview({ body: { type: "technical", questionLimit: "5" }, get: () => "request" }, missing.api);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, "RESUME_REQUIRED");
  const invalid = response();
  await controller.startInterview({ body: { type: "technical", questionLimit: "5" }, file: { mimetype: "application/pdf", buffer: Buffer.from("not pdf") }, get: () => "request" }, invalid.api);
  assert.equal(invalid.status, 415);
});

test("mock interview router is public and does not import auth middleware", () => {
  const route = fs.readFileSync(path.join(__dirname, "../routes/mockInterviewRoutes.js"), "utf8");
  assert.equal(route.includes("authMiddleware"), false);
  assert.match(route, /router\.post\("\/start"/);
  assert.match(route, /router\.post\("\/:interviewId\/answer"/);
});
