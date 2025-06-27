const request = require("supertest");
const app = require("../app");
const db = require("../models");
const bcrypt = require("bcrypt");

let agent;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  agent = request.agent(app);

  // Create educator user
  const hashedEducatorPwd = await bcrypt.hash("Educator@123", 10);
  await db.User.create({
    name: "Educator One",
    email: "educator@example.com",
    password: hashedEducatorPwd,
    role: "educator",
  });

  // Create student user
  const hashedStudentPwd = await bcrypt.hash("Student@123", 10);
  await db.User.create({
    name: "Student One",
    email: "student@example.com",
    password: hashedStudentPwd,
    role: "student",
  });
});

afterAll(async () => {
  await db.sequelize.close();
});

// Helper to extract CSRF token from rendered form
async function getCsrfToken(agent, route = "/login") {
  const res = await agent.get(route);
  const match = /name="_csrf" value="(.+?)"/.exec(res.text);
  return match ? match[1] : "";
}

describe("Dashboard Access", () => {
  test("GET /dashboard should render student dashboard after login", async () => {
    const csrfToken = await getCsrfToken(agent, "/login");

    // Log in as student
    await agent.post("/session").type("form").send({
      email: "student@example.com",
      password: "Student@123",
      _csrf: csrfToken,
    });

    const dashboardRes = await agent.get("/dashboard");
    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.text).toContain("Available Courses"); // Specific to student view
    expect(dashboardRes.text).toContain("My Courses");
  });

  test("GET /dashboard should render educator dashboard after login", async () => {
    const csrfToken = await getCsrfToken(agent, "/login");

    // Logout current user first
    await agent.get("/signout");

    // Log in as educator
    await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrfToken,
    });

    const dashboardRes = await agent.get("/dashboard");
    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.text).toContain("Create a new course"); // Specific to educator view
    expect(dashboardRes.text).toContain("View reports");
  });

  test("GET /dashboard should redirect if user not logged in", async () => {
    await agent.get("/signout");

    const res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe("/login");
  });
});
