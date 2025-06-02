const req = require("supertest");

const db = require("../models/index");
const app = require("../app");

let server, agent;

describe("Course Management API", () => {
  beforeAll(async () => {
    server = app.listen(3000);
    agent = req.agent(server);
    await db.sequelize.sync({ force: true }); // Reset the database
  });

  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  describe("POST /courses", () => {
    it("should create a new course", async () => {
      const courseData = {
        title: "Test Course",
        description: "This is a test course",
        educatorId: 1,
        imageUrl: "http://example.com/image.jpg",
      };

      const response = await agent.post("/courses").send(courseData);
      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(courseData.title);
    });

    it("should return 400 for invalid title", async () => {
      const courseData = {
        title: 123, // Invalid title
        description: "This is a test course",
        educatorId: 1,
        imageUrl: "http://example.com/image.jpg",
      };

      const response = await agent.post("/courses").send(courseData);
      expect(response.statusCode).toBe(400);
      expect(response.text).toBe("Title must be a string");
    });
  });

  describe("GET /courses/:educatorId", () => {
    it("should fetch courses by educator ID", async () => {
      const response = await agent.get("/courses/1");
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should return 404 if no courses found for educator", async () => {
      const response = await agent.get("/courses/999"); // Non-existent educator ID
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe("No courses found for this educator");
    });
  });
});
