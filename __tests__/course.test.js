const request = require("supertest");
const app = require("../app");
const db = require("../models");
const bcrypt = require("bcrypt");

let agent;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  agent = request.agent(app);

  const hashedPwd = await bcrypt.hash("Educator@123", 10);
  await db.User.create({
    name: "Educator One",
    email: "educator@example.com",
    password: hashedPwd,
    role: "educator",
  });

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

const getCsrfToken = async (agent, path = "/login") => {
  const res = await agent.get(path);
  const match = /name="_csrf" value="(.+?)"/.exec(res.text);
  return match ? match[1] : "";
};

let courseId, chapterId, pageId;

describe("Educator Course Flow", () => {
  test("Educator login", async () => {
    const csrf = await getCsrfToken(agent);
    const res = await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrf,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Create course", async () => {
    const csrf = await getCsrfToken(agent, "/course/create");
    const res = await agent.post("/course/create").type("form").send({
      title: "Test Course",
      description: "A great course",
      imageUrl: "https://example.com/image.jpg",
      _csrf: csrf,
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location;
    courseId = location.split("/")[2];
    expect(courseId).toBeDefined();
  });

  test("Create chapter", async () => {
    const csrf = await getCsrfToken(
      agent,
      `/course/${courseId}/chapter/create`,
    );
    const res = await agent
      .post(`/course/${courseId}/chapter/create`)
      .type("form")
      .send({
        title: "Intro Chapter",
        description: "First chapter",
        _csrf: csrf,
      });
    expect(res.statusCode).toBe(302);
    const chapter = await db.Chapter.findOne({
      where: { title: "Intro Chapter" },
    });
    expect(chapter).toBeTruthy();
    chapterId = chapter.id;
  });

  test("Create page", async () => {
    const csrf = await getCsrfToken(
      agent,
      `/course/${courseId}/chapter/${chapterId}/page/create`,
    );
    const res = await agent
      .post(`/course/${courseId}/chapter/${chapterId}/page/create`)
      .type("form")
      .send({ title: "Page One", content: "Some content", _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const page = await db.Page.findOne({ where: { title: "Page One" } });
    expect(page).toBeTruthy();
    pageId = page.id;
  });

  test("Edit course", async () => {
    const csrf = await getCsrfToken(agent, `/course/${courseId}/edit`);
    const res = await agent
      .put(`/course/${courseId}`)
      .type("form")
      .send({ title: "Updated Course", _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const updated = await db.Course.findByPk(courseId);
    expect(updated.title).toBe("Updated Course");
  });

  test("Edit chapter", async () => {
    const csrf = await getCsrfToken(agent, `/chapter/${chapterId}/edit`);
    const res = await agent
      .put(`/chapter/${chapterId}`)
      .type("form")
      .send({ title: "Updated Chapter", _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const updated = await db.Chapter.findByPk(chapterId);
    expect(updated.title).toBe("Updated Chapter");
  });

  test("Edit page", async () => {
    const csrf = await getCsrfToken(agent, `/page/${pageId}/edit`);
    const res = await agent
      .put(`/page/${pageId}`)
      .type("form")
      .send({ title: "Updated Page", _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const updated = await db.Page.findByPk(pageId);
    expect(updated.title).toBe("Updated Page");
  });

  test("Student login and enroll in course", async () => {
    await agent.get("/signout");
    const csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "student@example.com",
      password: "Student@123",
      _csrf: csrf,
    });

    const csrfEnroll = await getCsrfToken(agent, `/course/${courseId}`);
    const res = await agent
      .post(`/course/${courseId}/enroll`)
      .type("form")
      .send({ _csrf: csrfEnroll });
    expect(res.statusCode).toBe(302);
    const enrollment = await db.Enrollment.findOne({ where: { courseId } });
    expect(enrollment).toBeTruthy();
  });
  test("Relogin as educator", async () => {
    await agent.get("/signout");
    const csrf = await getCsrfToken(agent);
    const res = await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrf,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Delete page", async () => {
    const csrf = await getCsrfToken(agent, `/page/${pageId}/edit`);
    const res = await agent
      .post(`/page/${pageId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const page = await db.Page.findByPk(pageId);
    expect(page).toBeNull();
  });

  test("Delete chapter", async () => {
    const csrf = await getCsrfToken(agent, `/chapter/${chapterId}/edit`);
    const res = await agent
      .post(`/chapter/${chapterId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const chapter = await db.Chapter.findByPk(chapterId);
    expect(chapter).toBeNull();
  });

  test("Delete course", async () => {
    const csrf = await getCsrfToken(agent, `/course/${courseId}/edit`);
    const res = await agent
      .post(`/course/${courseId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const course = await db.Course.findByPk(courseId);
    expect(course).toBeNull();
  });
});
