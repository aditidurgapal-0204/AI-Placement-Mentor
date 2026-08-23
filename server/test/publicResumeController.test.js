"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const extractorPath = require.resolve("../services/publicPdfTextExtractor");
const analyzerPath = require.resolve("../services/publicResumeAnalyzerService");
const controllerPath = require.resolve("../controllers/publicResumeController");

const invoke = async (file) => {
  require.cache[extractorPath] = { id: extractorPath, filename: extractorPath, loaded: true, exports: { extractPdfTextFromBuffer: async () => "EDUCATION\nB.Tech\nSKILLS\nJavaScript React Node.js\nPROJECTS\nMentor App\nBuilt a working application with multiple features and clear documentation." } };
  require.cache[analyzerPath] = { id: analyzerPath, filename: analyzerPath, loaded: true, exports: { analyzePublicResume: async () => ({ contractVersion: "1.0", atsScore: 64 }) } };
  delete require.cache[controllerPath];
  const { analyzeResume } = require(controllerPath);
  let statusCode;
  let body;
  await analyzeResume({ file, get: () => "public-request" }, { status(code) { statusCode = code; return this; }, json(value) { body = value; return value; } });
  return { statusCode, body };
};

test("public controller requires no authenticated user and accepts a valid PDF signature", async () => {
  const result = await invoke({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-valid") });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.analysis.atsScore, 64);
});

test("public controller gives safe errors for missing and disguised files", async () => {
  const missing = await invoke(undefined);
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.code, "FILE_REQUIRED");
  const disguised = await invoke({ mimetype: "application/pdf", buffer: Buffer.from("not-a-pdf") });
  assert.equal(disguised.statusCode, 415);
  assert.equal(disguised.body.code, "PDF_REQUIRED");
  assert.equal(JSON.stringify(disguised.body).includes("stack"), false);
});
