const request = require("supertest");
const app = require("../app");
const db = require("../models");
const bcrypt = require("bcrypt");

let agent;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  agent = request.agent(app);
  const hashedPassword = await bcrypt.hash("Password@123", 10);
  await db.User.create({
    name: "Test User",
    email: "test@example.com",
    password: hashedPassword,
    role: "student",
  });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Authentication Flow", () => {
  test("GET /signup should return 200", async () => {
    const res = await agent.get("/signup");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Sign Up");
  });

  test("POST /users should register a new user", async () => {
    const csrfToken = await getCsrfToken(agent, "/signup");

    const res = await agent.post("/users").send({
      name: "Test User",
      email: "test1@example.com",
      password: "Password123",
      role: "student",
      _csrf: csrfToken,
    });

    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/dashboard");
  });

  test("POST /users should fail if email already exists", async () => {
    const csrfToken = await getCsrfToken(agent, "/signup");

    const res = await agent.post("/users").send({
      name: "Duplicate User",
      email: "test@example.com",
      password: "Password@123",
      role: "student",
      _csrf: csrfToken,
    });
    expect(res.header.location).toBe("/signup");
  });

  test("POST /session should login user", async () => {
    const csrfToken = await getCsrfToken(agent, "/login");
    const res = await agent.post("/session").type("form").send({
      email: "test@example.com",
      password: "Password@123",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/dashboard");
  });

  test("POST /session should fail with wrong password", async () => {
    const csrfToken = await getCsrfToken(agent, "/login");
    const res = await agent.post("/session").type("form").send({
      email: "test@example.com",
      password: "WrongPassword",
      _csrf: csrfToken,
    });

    console.log("Status:", res.statusCode);
    console.log("Location:", res.header.location);
    console.log("Body:", res.text);

    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/login");
  });

  test("GET /signout should logout user", async () => {
    const res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/");
  });

  test("POST /changepassword should update the password", async () => {
    const csrfLogin = await getCsrfToken(agent, "/login");
    await agent.post("/session").type("form").send({
      email: "test@example.com",
      password: "Password@123",
      _csrf: csrfLogin,
    });

    const csrf = await getCsrfToken(agent, "/changepassword");

    const res = await agent.post("/changepassword").type("form").send({
      currentPassword: "Password@123",
      newPassword: "NewPassword@123",
      confirmPassword: "NewPassword@123",
      _csrf: csrf,
    });

    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/dashboard");

    await agent.get("/signout");

    const csrfNewLogin = await getCsrfToken(agent, "/login");
    const loginResponse = await agent.post("/session").type("form").send({
      email: "test@example.com",
      password: "NewPassword@123",
      _csrf: csrfNewLogin,
    });

    expect(loginResponse.statusCode).toBe(302);
    expect(loginResponse.header.location).toBe("/dashboard");
  });
});

async function getCsrfToken(agent, route = "/signup") {
  const res = await agent.get(route);
  const match = /name="_csrf" value="(.+?)"/.exec(res.text);
  return match ? match[1] : "";
}
