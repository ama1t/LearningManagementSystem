const express = require("express");
const app = express();
const { Course } = require("./models");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/course", async (req, res) => {
  try {
    const { title, description, educatorId, imageUrl } = req.body;

    if (typeof title !== "string") {
      return res.redirect("/course-create");
    }

    await Course.createCourse(title, description, educatorId, imageUrl);
    return res.redirect("/educator");
  } catch (error) {
    console.error("Error creating course:", error);
    return res.redirect("/course-create");
  }
});

app.get("/courses/:educatorId", async (req, res) => {
  const educatorId = req.params.educatorId;
  try {
    const courses = await Course.findByEducatorId(educatorId);
    if (courses.length === 0) {
      return res
        .status(404)
        .json({ error: "No courses found for this educator" });
    }
    return res.json(courses);
  } catch (error) {
    console.error("Error fetching courses by educator ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/educator", async (req, res) => {
  // try {
  const courses = await Course.getAllCourses();
  if (req.accepts("html")) {
    return res.render("educator.ejs", { courses });
  } else res.json(courses);

  // } catch (error) {
  //   console.error("Error fetching courses:", error);
  //   res.status(500).json({ error: "Internal server error" });
  // }
});

app.get("/create-course", (req, res) => {
  if (req.accepts("html")) {
    return res.render("createCourses.ejs");
  } else {
    return res.status(400).json({ error: "Invalid request format" });
  }
});

app.get("/my-courses", async (req, res) => {
  try {
    const courses = await Course.getAllCourses();
    if (req.accepts("html")) {
      return res.render("educatorCourses.ejs", { courses });
    } else {
      return res.json(courses);
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/student", async (req, res) => {
  try {
    const courses = await Course.getAllCourses();
    if (req.accepts("html")) {
      return res.render("student.ejs", { courses });
    } else {
      return res.json(courses);
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;
