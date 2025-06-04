const express = require("express");
const app = express();
const { Course, User, Chapter } = require("./models");
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
    if (req.accepts("html")) {
      if (req.user && req.user.role === "educator") {
        return res.render("educator.ejs", { courses });
      }
      if (req.user && req.user.role === "student") {
        return res.render("student.ejs", { courses });
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
  try {
    const courses = await Course.findByEducatorId(req.user.id);
    if (req.accepts("html")) {
      return res.render("educatorCourses.ejs", {
        courses,
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

module.exports = app;
