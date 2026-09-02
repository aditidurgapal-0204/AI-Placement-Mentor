const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "test-only-jwt-secret";

const prismaPath = require.resolve("../lib/prisma");
const controllerPath = require.resolve("../controllers/signupController");

const loadSignup = (user) => {
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { user } };
  delete require.cache[controllerPath];
  return require(controllerPath).signup;
};

const invoke = async (signup, body) => {
  const result = { status: 200, body: null };
  const res = {
    status(code) { result.status = code; return this; },
    json(value) { result.body = value; return this; }
  };
  await signup({ body }, res);
  return result;
};

test("creates a normalized user with a bcrypt password hash", async () => {
  let createdData;
  const signup = loadSignup({
    findUnique: async () => null,
    create: async ({ data }) => {
      createdData = data;
      return { id: "user-1", ...data };
    }
  });
  const result = await invoke(signup, { name: "Test User", email: " TEST@Example.com ", password: "Secure1" });
  assert.equal(result.status, 201);
  assert.equal(createdData.email, "test@example.com");
  assert.equal(await bcrypt.compare("Secure1", createdData.password), true);
  assert.equal(result.body.user.password, undefined);
});

test("returns 409 for an existing normalized email", async () => {
  const signup = loadSignup({ findUnique: async () => ({ id: "existing" }), create: async () => assert.fail("must not create") });
  const result = await invoke(signup, { name: "Test User", email: "EXISTING@example.com", password: "Secure1" });
  assert.equal(result.status, 409);
});

for (const [name, body] of [
  ["invalid email", { name: "Test User", email: "invalid", password: "Secure1" }],
  ["missing field", { name: "", email: "test@example.com", password: "Secure1" }]
]) {
  test(`returns 400 for ${name}`, async () => {
    const signup = loadSignup({ findUnique: async () => null, create: async () => null });
    const result = await invoke(signup, body);
    assert.equal(result.status, 400);
    assert.equal(typeof result.body.message, "string");
  });
}

test("returns a safe 503 when the database pool is unavailable", async () => {
  const error = Object.assign(new Error("sensitive database detail"), { code: "P2024" });
  const signup = loadSignup({ findUnique: async () => { throw error; }, create: async () => null });
  const result = await invoke(signup, { name: "Test User", email: "test@example.com", password: "Secure1" });
  assert.equal(result.status, 503);
  assert.equal(result.body.message.includes("sensitive"), false);
});

test("returns safe JSON for an unexpected backend error", async () => {
  const signup = loadSignup({ findUnique: async () => { throw new Error("internal detail"); }, create: async () => null });
  const result = await invoke(signup, { name: "Test User", email: "test@example.com", password: "Secure1" });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { message: "Server error. Please try again later." });
});
