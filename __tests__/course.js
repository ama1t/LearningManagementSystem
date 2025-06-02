const request = require("supertest");
const db = require("../models/index");
const app = require("../app");

let server, agent;

describe("Course Management API - Create Course", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true }); // Reset DB
    server = app.listen(3001);
    agent = request.agent(server);
  });

  afterAll(async () => {
    await db.sequelize.close();
    await server.close();
  });

  test("should create a course successfully", async () => {
    const courseData = {
      title: "Full Stack Development",
      description: "Learn full stack web development",
      educatorId: 1,
      imageUrl: "http://example.com/course.jpg",
    };

    const res = await agent.post("/course").send(courseData);

    expect(302).toBe(302);
  });
});
