const request = require("supertest");
const app = require("../app");
const db = require("../models");
const bcrypt = require("bcrypt");

let agent;
let courseId, chapterId, pageId;
let enrollmentCourseId;
let testCompletionCourseId, testCompletionChapterId, testCompletionPageId;

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

  const studentHashedPwd = await bcrypt.hash("Student@123", 10);
  await db.User.create({
    name: "Student One",
    email: "student@example.com",
    password: studentHashedPwd,
    role: "student",
  });

  let csrf = await getCsrfToken(agent);
  await agent.post("/session").type("form").send({
    email: "educator@example.com",
    password: "Educator@123",
    _csrf: csrf,
  });

  csrf = await getCsrfToken(agent, "/course/create");
  const res = await agent.post("/course/create").type("form").send({
    title: "Enrollment Course",
    description: "Used for enrollment testing",
    imageUrl: "https://example.com/enroll.jpg",
    _csrf: csrf,
  });
  enrollmentCourseId = res.headers.location.split("/")[2];

  const csrfCourse = await getCsrfToken(agent, "/course/create");
  const courseRes = await agent.post("/course/create").type("form").send({
    title: "Completion Test Course",
    description: "Course to test completion",
    imageUrl: "https://example.com/completion.jpg",
    _csrf: csrfCourse,
  });
  testCompletionCourseId = courseRes.headers.location.split("/")[2];

  const csrfChapter = await getCsrfToken(
    agent,
    `/course/${testCompletionCourseId}/chapter/create`,
  );
  await agent
    .post(`/course/${testCompletionCourseId}/chapter/create`)
    .type("form")
    .send({
      title: "Completion Chapter",
      description: "Chapter for completion test",
      _csrf: csrfChapter,
    });
  testCompletionChapterId = (
    await db.Chapter.findOne({ where: { title: "Completion Chapter" } })
  ).id;

  const csrfPage = await getCsrfToken(
    agent,
    `/course/${testCompletionCourseId}/chapter/${testCompletionChapterId}/page/create`,
  );
  await agent
    .post(
      `/course/${testCompletionCourseId}/chapter/${testCompletionChapterId}/page/create`,
    )
    .type("form")
    .send({
      title: "Completion Page",
      content: "Content for test page",
      _csrf: csrfPage,
    });
  testCompletionPageId = (
    await db.Page.findOne({ where: { title: "Completion Page" } })
  ).id;

  await agent.get("/signout");
});

afterAll(async () => {
  await db.sequelize.close();
});

const getCsrfToken = async (agent, path = "/login") => {
  const res = await agent.get(path);
  const match = /name="_csrf" value="(.+?)"/.exec(res.text);
  return match ? match[1] : "";
};

describe("Course Flow", () => {
  test("Create course", async () => {
    let csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrf,
    });

    csrf = await getCsrfToken(agent, "/course/create");
    const res = await agent.post("/course/create").type("form").send({
      title: "Test Course",
      description: "A great course",
      imageUrl: "https://example.com/image.jpg",
      _csrf: csrf,
    });
    expect(res.statusCode).toBe(302);
    courseId = res.headers.location.split("/")[2];
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
    chapterId = (
      await db.Chapter.findOne({ where: { title: "Intro Chapter" } })
    ).id;
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
    pageId = (await db.Page.findOne({ where: { title: "Page One" } })).id;
  });

  test("Edit course", async () => {
    const csrf = await getCsrfToken(agent, `/course/${courseId}/edit`);
    await agent.put(`/course/${courseId}`).type("form").send({
      title: "Updated Course",
      _csrf: csrf,
    });
    const updated = await db.Course.findByPk(courseId);
    expect(updated.title).toBe("Updated Course");
  });

  test("Edit chapter", async () => {
    const csrf = await getCsrfToken(agent, `/chapter/${chapterId}/edit`);
    await agent.put(`/chapter/${chapterId}`).type("form").send({
      title: "Updated Chapter",
      _csrf: csrf,
    });
    const updated = await db.Chapter.findByPk(chapterId);
    expect(updated.title).toBe("Updated Chapter");
  });

  test("Edit page", async () => {
    const csrf = await getCsrfToken(agent, `/page/${pageId}/edit`);
    await agent.put(`/page/${pageId}`).type("form").send({
      title: "Updated Page",
      _csrf: csrf,
    });
    const updated = await db.Page.findByPk(pageId);
    expect(updated.title).toBe("Updated Page");
  });

  test("Delete page", async () => {
    const csrf = await getCsrfToken(agent, `/page/${pageId}/edit`);
    await agent
      .post(`/page/${pageId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    const page = await db.Page.findByPk(pageId);
    expect(page).toBeNull();
  });

  test("Delete chapter", async () => {
    const csrf = await getCsrfToken(agent, `/chapter/${chapterId}/edit`);
    await agent
      .post(`/chapter/${chapterId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    const chapter = await db.Chapter.findByPk(chapterId);
    expect(chapter).toBeNull();
  });

  test("Delete course", async () => {
    const csrf = await getCsrfToken(agent, `/course/${courseId}/edit`);
    await agent
      .post(`/course/${courseId}/delete`)
      .type("form")
      .send({ _csrf: csrf });
    const course = await db.Course.findByPk(courseId);
    expect(course).toBeNull();
  });

  test("Educator can search own courses in /course", async () => {
    const csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrf,
    });
    await agent.post("/course/create").type("form").send({
      title: "My Course",
      description: "My created course",
      imageUrl: "https://example7.com/other.jpg",
      _csrf: csrf,
    });
    const res = await agent.get("/course?q=My Course");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("My Course");
  });

  test("Educator can search other users' courses in /dashboard", async () => {
    const hashedPwd2 = await bcrypt.hash("Educator2@123", 10);
    await db.User.create({
      name: "Educator Two",
      email: "educator2@example.com",
      password: hashedPwd2,
      role: "educator",
    });

    let csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "educator2@example.com",
      password: "Educator2@123",
      _csrf: csrf,
    });

    csrf = await getCsrfToken(agent, "/course/create");
    await agent.post("/course/create").type("form").send({
      title: "Public Course",
      description: "Visible to others",
      imageUrl: "https://example.com/other.jpg",
      _csrf: csrf,
    });

    await agent.get("/signout");

    csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "educator@example.com",
      password: "Educator@123",
      _csrf: csrf,
    });

    const res = await agent.get("/dashboard?q=Public");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Public Course");
  });

  test("Student can view courses in /dashboard", async () => {
    const csrf = await getCsrfToken(agent);
    await agent.post("/session").type("form").send({
      email: "student@example.com",
      password: "Student@123",
      _csrf: csrf,
    });
    const res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Public Course");
  });

  test("Student can search courses in /dashboard", async () => {
    const res = await agent.get("/dashboard?q=Public");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Public Course");
  });

  test("Student can enroll in a course", async () => {
    const csrf = await getCsrfToken(agent, "/dashboard");
    const res = await agent
      .post(`/course/${enrollmentCourseId}/enroll`)
      .type("form")
      .send({ _csrf: csrf });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/mycourses/${enrollmentCourseId}`);
  });

  test("Student can search enrolled course in /mycourses", async () => {
    const res = await agent.get("/mycourses?q=Enrollment Course");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Enrollment Course");
  });

  test("Student can mark a page as completed", async () => {
    const csrf = await getCsrfToken(
      agent,
      `/mycourses/${testCompletionCourseId}/chapter/${testCompletionChapterId}/page/${testCompletionPageId}/view`,
    );
    const res = await agent
      .post(`/completions/${testCompletionPageId}`)
      .type("form")
      .send({ _csrf: csrf });
    expect(res.statusCode).toBe(302);
    const completion = await db.Completion.findOne({
      where: {
        courseId: testCompletionCourseId,
        pageId: testCompletionPageId,
      },
    });
    expect(completion).toBeTruthy();
  });
});
