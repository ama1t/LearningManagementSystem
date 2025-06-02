const express = require("express");
const app = express();
const { Course } = require("./models");

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Course Management API");
});

// app.post("/courses", async (req, res) => {
//   try {
//     //const { title, description, educatorId, imageUrl } = req.body;
//     // Create course
//     const course = await Course.createCourse({
//       title: req.body.title,
//       description: req.body.description,
//       educatorId: req.body.educatorId,
//       imageUrl: req.body.imageUrl,
//     });
//     return res.json(course);
//   } catch (error) {
//     console.error("Error creating course:", error);
//     res.response.status(422).json(error);
//   }
// });

app.post("/courses", async (req, res) => {
  try {
    const { title, description, educatorId, imageUrl } = req.body;

    if (typeof title !== "string") {
      return res.status(400).send("Title must be a string");
    }

    const course = await Course.createCourse(
      title,
      description,
      educatorId,
      imageUrl,
    );
    return res.json(course);
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(422).json(error);
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

app.get("/courses", async (req, res) => {
  try {
    const courses = await Course.getAllCourses();
    return res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;
