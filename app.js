const express = require("express");
const app = express();
const { Course, User, Chapter, Page, Enrollment } = require("./models");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("your secret here"));
app.use(csrf("123456789iamasecret987654321look", ["POST", "PUT", "DELETE"]));
//const path = require("path");

app.use(
  session({
    secret: "your secret here",
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  }),
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      await User.findOne({ where: { email: email } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid email or password" });
          }
        })
        .catch((error) => {
          return done(error);
        });
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  res.render("index", {
    title: "Todo Application",
    csrfToken: req.csrfToken(),
  });
});

app.get("/signup", (req, res) => {
  if (req.accepts("html")) {
    return res.render("signup.ejs", {
      title: "Sign Up",
      csrfToken: req.csrfToken(),
    });
  } else {
    return res.status(400).json({ error: "Invalid request format" });
  }
});

app.post("/users", async (req, res) => {
  const hashpwd = await bcrypt.hash(req.body.password, saltRounds);
  try {
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashpwd,
      role: req.body.role,
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      console.log(req.body.role);
      res.redirect("/dashboard");
    });
  } catch (error) {
    console.log(error);
  }
});

app.get("/login", (req, res) => {
  if (req.accepts("html")) {
    return res.render("login.ejs", {
      title: "Log In",
      csrfToken: req.csrfToken(),
    });
  } else {
    return res.status(400).json({ error: "Invalid request format" });
  }
});

app.post(
  "/session",
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    console.log("User authenticated successfully");
    console.log(req.user.role);
    res.redirect("/dashboard");
  },
);

app.get("/signout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Internal server error");
    }
    console.log("User logged out successfully");
    res.redirect("/");
  });
});

app.get("/dashboard", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  try {
    const courses = await Course.getAllCourses();
    const user = await User.findByPk(req.user.id);

    if (req.accepts("html")) {
      if (req.user && req.user.role === "educator") {
        return res.render("educator.ejs", {
          courses,
          user,
        });
      }

      if (req.user && req.user.role === "student") {
        // Fetch enrolled courses
        const enrolledCourses = await Enrollment.findAll({
          where: { studentId: req.user.id },
          attributes: ["courseId"],
        });

        const enrolledCourseIds = enrolledCourses.map((e) => e.courseId);

        return res.render("student.ejs", {
          courses,
          user,
          csrfToken: req.csrfToken(),
          enrolledCourseIds,
        });
      }
    } else {
      return res.json(courses);
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/course", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const userId = req.user.id;
  try {
    const courses = await Course.findByEducatorId(userId);
    if (req.accepts("html")) {
      return res.render("educatorCourses.ejs", {
        courses,
        userId,
      });
    } else {
      return res.json(courses);
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/course/create", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  if (req.accepts("html")) {
    return res.render("createCourses.ejs", {
      title: "Create Course",
      csrfToken: req.csrfToken(),
    });
  } else {
    return res.status(400).json({ error: "Invalid request format" });
  }
});

app.post(
  "/course/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { title, description, imageUrl } = req.body;
    try {
      const course = await Course.createCourse(
        title,
        description,
        imageUrl,
        req.user.id,
      );

      // Redirect to chapter management page of the new course
      return res.redirect(`/course/${course.id}`);
    } catch (error) {
      console.error("Error creating course:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.get(
  "/course/:courseId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;

    try {
      const chapters = await Chapter.getChapterByCourseId(courseId);
      const course = await Course.findById(courseId);
      return res.render("educhapter.ejs", {
        title: "Manage Chapters",
        chapters: chapters,
        courseId: courseId, // helpful if you need it in the UI
        course: course,
      });
    } catch (error) {
      console.error("Error fetching chapters:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.get(
  "/course/:courseId/chapter/create",
  connectEnsureLogin.ensureLoggedIn(),
  (req, res) => {
    const courseId = req.params.courseId;
    res.render("createChapter.ejs", {
      title: "Create Chapter",
      csrfToken: req.csrfToken(),
      courseId,
    });
  },
);

app.post(
  "/course/:courseId/chapter/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { title, description } = req.body;
    const courseId = req.params.courseId;
    try {
      await Chapter.createChapter(title, description, courseId);
      res.redirect(`/course/${courseId}`);
    } catch (err) {
      console.error("Error creating chapter:", err);
      res.status(500).send("Failed to create chapter");
    }
  },
);

app.get(
  "/course/:courseId/chapter/:chapterId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const { courseId, chapterId } = req.params;
      const chapter = await Chapter.findById(chapterId);
      const pages = await Page.getPagesByChapterId(chapterId);
      res.render("edupages.ejs", {
        pages,
        chapter,
        courseId,
        csrfToken: req.csrfToken(),
      });
    } catch (error) {
      console.error("Error fetching chapter or pages:", error);
      res.status(500).send("Internal server error");
    }
  },
);

app.get(
  "/course/:courseId/chapter/:chapterId/page/create",
  connectEnsureLogin.ensureLoggedIn(),
  (req, res) => {
    const { courseId, chapterId } = req.params;
    res.render("createPages.ejs", {
      title: "Create Page",
      csrfToken: req.csrfToken(),
      courseId,
      chapterId,
    });
  },
);
app.post(
  "/course/:courseId/chapter/:chapterId/page/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { title, content } = req.body;
    const { courseId, chapterId } = req.params;
    try {
      await Page.create({
        title,
        content,
        chapterId,
      });
      res.redirect(`/course/${courseId}/chapter/${chapterId}`);
    } catch (err) {
      console.error("Error creating page:", err);
      res.status(500).send("Failed to create page");
    }
  },
);

app.get(
  "/course/:courseId/chapter/:chapterId/page/:pageId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { courseId, chapterId, pageId } = req.params;
    try {
      const page = await Page.findById(pageId);
      if (!page) {
        return res.status(404).send("Page not found");
      }
      res.render("eduviewpage.ejs", {
        page,
        courseId,
        chapterId,
        csrfToken: req.csrfToken(),
      });
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).send("Internal server error");
    }
  },
);

app.get(
  "/course/:courseId/view",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId);
    const chapters = await Chapter.getChapterByCourseId(courseId);
    const pages = await Page.findAll();
    if (req.accepts("html")) {
      return res.render("viewCourse.ejs", {
        title: "View Course",
        courseId,
        course,
        chapters,
        pages,
      });
    } else {
      return res.status(400).json({ error: "Invalid request format" });
    }
  },
);

app.post(
  "/course/:courseId/enroll",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    try {
      await Enrollment.create({ studentId: userId, courseId });
      res.redirect(`/mycourses/${courseId}`);
    } catch (error) {
      console.error("Error enrolling in course:", error);
      res.status(500).send("Failed to enroll in course");
    }
  },
);

app.get("/mycourses", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const userId = req.user.id;

  try {
    const enrollments = await Enrollment.findAll({
      where: { studentId: userId },
      include: [
        {
          model: Course,
          as: "courseEnrollments",
        },
      ],
    });

    if (req.accepts("html")) {
      return res.render("studentCourses.ejs", {
        enrollments,
        userId,
        csrfToken: req.csrfToken(),
      });
    } else {
      return res.json(enrollments);
    }
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/mycourses/:courseId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;
    try {
      const course = await Course.findById(courseId);
      const chapters = await Chapter.getChapterByCourseId(courseId);
      const pages = await Page.findAll();
      res.render("studentView.ejs", {
        course,
        chapters,
        pages,
        csrfToken: req.csrfToken(),
      });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(500).send("Internal server error");
    }
  },
);

app.get(
  "/mycourses/:courseId/chapter/:chapterId/page/:pageId/view",
  async (req, res) => {
    const { courseId, chapterId, pageId } = req.params;
    try {
      const page = await Page.findById(pageId);
      if (!page) {
        return res.status(404).send("Page not found");
      }
      res.render("studentViewPage.ejs", {
        page,
        courseId,
        chapterId,
        csrfToken: req.csrfToken(),
      });
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).send("Internal server error");
    }
  },
);

module.exports = app;
