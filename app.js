const express = require("express");
const app = express();
const { Course, User } = require("./models");
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
  res.render("index");
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

app.get("/signin", (req, res) => {
  if (req.accepts("html")) {
    return res.render("signin.ejs", {
      title: "Sign In",
      csrfToken: req.csrfToken(),
    });
  } else {
    return res.status(400).json({ error: "Invalid request format" });
  }
});

app.post(
  "/session",
  passport.authenticate("local", { failureRedirect: "/signin" }),
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

app.post("/course", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
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

// app.get("/educator", async (req, res) => {
// try {
// const courses = await Course.getAllCourses();
// if (req.accepts("html")) {
//   return res.render("educator.ejs", { courses });
// } else res.json(courses);

// } catch (error) {
//   console.error("Error fetching courses:", error);
//   res.status(500).json({ error: "Internal server error" });
// }
// });

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

app.get("/dashboard", async (req, res) => {
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

module.exports = app;
