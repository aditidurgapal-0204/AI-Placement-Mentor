const assert = require("node:assert/strict");
const test = require("node:test");
const app = require("../server");

test("health endpoint exposes only a minimal running status", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("development CORS allows localhost and rejects unrelated browser origins", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/health`;
  const allowed = await fetch(base, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const rejected = await fetch(base, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { message: "Origin is not allowed." });
});
