const express = require("express");
const app = express();
const {
  Course,
  User,
  Chapter,
  Page,
  Enrollment,
  Completion,
} = require("./models");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const { Op, Sequelize } = require("sequelize");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const methodOverride = require("method-override");
const flash = require("connect-flash");

app.use(methodOverride("_method"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("your secret here"));
app.use(csrf("123456789iamasecret987654321look", ["POST", "PUT", "DELETE"]));
const path = require("path");
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: "your secret here",
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(flash());

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email: email } });

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const result = await bcrypt.compare(password, user.password);

        if (result) {
          return done(null, user);
        } else {
          return done(null, false, { message: "Invalid email or password" });
        }
      } catch (error) {
        return done(error);
      }
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
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      req.flash("error", "Account already exists with this email.");
      return res.redirect("/signup");
    }

    if (!password || password.length < 6) {
      req.flash("error", "Password must be at least 6 characters long.");
      return res.redirect("/signup");
    }

    const hashed = await bcrypt.hash(password, saltRounds);
    const user = await User.create({ name, email, password: hashed, role });

    req.login(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).send("Login failed");
      }
      req.flash("success", `Welcome, ${user.name}!`);
      return res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("Signup error:", error);
    req.flash("error", "Internal server error");
    return res.redirect("/signup");
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
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
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
    const user = await User.findByPk(req.user.id);
    const searchQuery = req.query.q?.trim() || "";

    const searchCondition = {
      [Op.or]: [
        { title: { [Op.iLike]: `%${searchQuery}%` } },
        { description: { [Op.iLike]: `%${searchQuery}%` } },
      ],
    };

    const commonQuery = {
      where: searchQuery ? searchCondition : {},
      include: [
        {
          model: Enrollment,
          as: "courseEnrollments",
          attributes: [],
        },
        {
          model: User,
          as: "educator",
          attributes: ["id", "name", "email"],
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.fn("COUNT", Sequelize.col("courseEnrollments.id")),
            "studentsCount",
          ],
        ],
      },
      group: ["Course.id", "educator.id"],
    };

    if (req.accepts("html")) {
      if (req.user.role === "educator") {
        const courses = await Course.findAll(commonQuery);

        return res.render("educator.ejs", {
          courses,
          user,
          searchQuery,
        });
      }

      if (req.user.role === "student") {
        const enrolledCourses = await Enrollment.findAll({
          where: { studentId: req.user.id },
          attributes: ["courseId"],
        });
        const enrolledCourseIds = enrolledCourses.map((e) => e.courseId);

        const courses = await Course.findAll(commonQuery);

        return res.render("student.ejs", {
          courses,
          user,
          csrfToken: req.csrfToken(),
          enrolledCourseIds,
          searchQuery,
        });
      }
    } else {
      const courses = await Course.findAll();
      return res.json(courses);
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/course", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const userId = req.user.id;
  const searchQuery = req.query.q || "";

  try {
    const whereCondition = {
      educatorId: userId,
      ...(searchQuery && {
        [Op.or]: [
          { title: { [Op.iLike]: `%${searchQuery}%` } },
          { description: { [Op.iLike]: `%${searchQuery}%` } },
        ],
      }),
    };

    const rawCourses = await Course.findAll({
      where: whereCondition,
      include: [
        {
          model: Enrollment,
          as: "courseEnrollments",
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.fn("COUNT", Sequelize.col("courseEnrollments.id")),
            "studentsCount",
          ],
        ],
      },
      group: ["Course.id"],
    });

    const courses = rawCourses.map((course) => {
      const plain = course.get({ plain: true });
      plain.students = course.get("studentsCount");
      return plain;
    });

    if (req.accepts("html")) {
      return res.render("educatorCourses.ejs", {
        courses,
        userId,
        user: req.user,
        csrfToken: req.csrfToken(),
        searchQuery,
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

      req.flash("success", "Course created successfully!");
      return res.redirect(`/course/${course.id}`);
    } catch (error) {
      console.error("Error creating course:", error);
      req.flash("error", "Something went wrong. Please try again.");
      return res.redirect("/course/create");
    }
  },
);

app.get(
  "/course/:courseId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;

    try {
      const chapters = await Chapter.findAll({
        where: { courseId },
        order: [["order", "ASC"]], // Order by the 'order' field
      });
      const course = await Course.findById(courseId);
      return res.render("educhapter.ejs", {
        title: "Manage Chapters",
        chapters: chapters,
        courseId: courseId, // helpful if you need it in the UI
        course: course,
        csrfToken: req.csrfToken(),
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
    const maxOrder = await Chapter.max("order", {
      where: { courseId: courseId },
    });
    try {
      await Chapter.create({
        title,
        description,
        courseId: courseId,
        order: (maxOrder || 0) + 1,
      });
      req.flash("success", "Chapter Added successfully!");
      res.redirect(`/course/${courseId}`);
    } catch (err) {
      console.error("Error creating chapter:", err);
      req.flash("error", "Something went wrong. Please try again.");
      res.redirect(`/course/${courseId}/chapter/create`);
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
      const pages = await Page.findAll({
        where: { chapterId },
        order: [["order", "ASC"]],
      });
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
    const maxOrder = await Page.max("order", {
      where: { chapterId: chapterId },
    });
    try {
      await Page.create({
        title,
        content,
        chapterId: chapterId,
        order: (maxOrder || 0) + 1,
      });
      req.flash("success", "Page Added successfully!");
      res.redirect(`/course/${courseId}/chapter/${chapterId}`);
    } catch (err) {
      console.error("Error creating page:", err);
      req.flash("error", "Something went wrong. Please try again.");
      res.redirect(`/course/${courseId}/chapter/${chapterId}/page/create`);
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

    try {
      const course = await Course.findByPk(courseId);

      const chapters = await Chapter.findAll({
        where: { courseId },
        order: [["order", "ASC"]],
      });

      const pages = await Page.findAll({
        order: [["order", "ASC"]],
      });

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
    } catch (error) {
      console.error("Error fetching course view:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.post(
  "/course/:courseId/enroll",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;
    if (!req.user) {
      console.error("No user in session");
      return res.status(401).send("Unauthorized");
    }

    const userId = req.user.id;

    try {
      await Enrollment.create({ studentId: userId, courseId });
      req.flash("success", "Enrolled successfully!");
      res.redirect(`/mycourses/${courseId}`);
    } catch (error) {
      console.error("Error enrolling in course:", error);
      req.flash("error", "Failed to enroll in course");
      res.redirect(`/mycourses`);
    }
  },
);

app.get("/mycourses", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const userId = req.user.id;
  const searchQuery = req.query.q?.trim().toLowerCase() || "";

  try {
    // Step 1: Get enrolled course IDs
    const enrollments = await Enrollment.findAll({
      where: { studentId: userId },
      attributes: ["courseId"],
    });
    const courseIds = enrollments.map((e) => e.courseId);

    // Step 2: Fetch courses with educator, chapters, pages
    const courses = await Course.findAll({
      where: {
        id: {
          [Op.in]: courseIds,
        },
      },
      include: [
        {
          model: User,
          as: "educator",
          attributes: ["name"],
        },
        {
          model: Enrollment,
          as: "courseEnrollments",
          attributes: [],
        },
        {
          model: Chapter,
          as: "chapters",
          include: [
            {
              model: Page,
              as: "pages",
              attributes: ["id"],
            },
          ],
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.fn("COUNT", Sequelize.col("courseEnrollments.id")),
            "studentsCount",
          ],
        ],
      },
      group: ["Course.id", "educator.id", "chapters.id", "chapters->pages.id"],
    });

    // Step 3: Fetch completed pages by the user
    const completions = await Completion.findAll({
      where: {
        userId,
        courseId: {
          [Op.in]: courseIds,
        },
      },
    });

    const completedPageIds = completions.map((c) => c.pageId);

    // Step 4: Calculate progress for each course
    const courseData = courses.map((course) => {
      const totalPages = course.chapters.reduce((sum, chapter) => {
        return sum + (chapter.pages ? chapter.pages.length : 0);
      }, 0);

      const completedPages = course.chapters.reduce((sum, chapter) => {
        return (
          sum +
          (chapter.pages || []).filter((p) => completedPageIds.includes(p.id))
            .length
        );
      }, 0);

      const progress =
        totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

      return {
        ...course.get({ plain: true }),
        progress,
      };
    });

    // Step 5: Filter by search query if present
    const filteredCourses = searchQuery
      ? courseData.filter(
          (course) =>
            course.title.toLowerCase().includes(searchQuery) ||
            course.description?.toLowerCase().includes(searchQuery),
        )
      : courseData;

    // Step 6: Render page
    res.render("studentCourses.ejs", {
      user: req.user,
      courses: filteredCourses,
      searchQuery,
    });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/mycourses/:courseId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    try {
      const course = await Course.findById(courseId);
      const chapters = await Chapter.findAll({
        where: { courseId },
        order: [["order", "ASC"]],
      });
      const pages = await Page.findAll({
        where: { chapterId: chapters.map((c) => c.id) },
        order: [["order", "ASC"]],
      });

      // Get all completions for the current user
      const completions = await Completion.findAll({
        where: { userId },
      });

      // Extract completed page IDs
      const completedPageIds = completions.map((comp) => comp.pageId);

      res.render("studentView.ejs", {
        course,
        chapters,
        pages,
        csrfToken: req.csrfToken(),
        completedPageIds, //  pass this to the EJS view
      });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(500).send("Internal server error");
    }
  },
);

app.get(
  "/mycourses/:courseId/chapter/:chapterId/page/:pageId/view",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { courseId, chapterId, pageId } = req.params;

    try {
      const page = await Page.findByPk(pageId);
      if (!page) return res.status(404).send("Page not found");

      const pages = await Page.findAll({
        where: { chapterId },
        order: [["order", "ASC"]], // or sort by page number if available
      });

      const index = pages.findIndex((p) => p.id === parseInt(pageId));
      const previousPage = index > 0 ? pages[index - 1] : null;
      const nextPage = index < pages.length - 1 ? pages[index + 1] : null;

      // Check if the current page is completed
      const isCompleted = await Completion.findOne({
        where: {
          userId: req.user.id,
          pageId: page.id,
        },
      });

      res.render("studentViewPage.ejs", {
        page,
        courseId,
        chapterId,
        csrfToken: req.csrfToken(),
        previousPage,
        nextPage,
        isCompleted: !!isCompleted,
      });
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).send("Internal server error");
    }
  },
);

// GET: Show edit form
app.get(
  "/course/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const course = await Course.findByPk(req.params.id);
    res.render("editCourse", { course, csrfToken: req.csrfToken() });
  },
);

// PUT: Update course
app.put(
  "/course/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).send("Course not found");
    }

    if (req.body.title !== undefined) course.title = req.body.title;
    if (req.body.description !== undefined)
      course.description = req.body.description;
    if (req.body.imageUrl !== undefined) course.imageUrl = req.body.imageUrl;

    await course.save();
    req.flash("success", "Course updated successfully!");
    res.redirect(`/course`);
  },
);

// GET: Show edit form
app.get(
  "/chapter/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const chapter = await Chapter.findByPk(req.params.id);
    res.render("editChapter", { chapter, csrfToken: req.csrfToken() });
  },
);

// PUT: Update chapter
app.put(
  "/chapter/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const chapter = await Chapter.findByPk(req.params.id);
    if (!chapter) {
      req.flash("error", "Chapter not found");
      return res.redirect("/course");
    }

    const { title, description, order } = req.body;

    if (order !== undefined) {
      const parsedOrder = parseInt(order);
      if (!isNaN(parsedOrder)) {
        const exists = await Chapter.findOne({
          where: {
            courseId: chapter.courseId,
            order: parsedOrder,
            id: { [Op.ne]: chapter.id },
          },
        });

        if (exists) {
          req.flash(
            "error",
            `Order ${parsedOrder} already exists in this course`,
          );
          return res.redirect(`/chapter/${chapter.id}/edit`);
        }

        chapter.order = parsedOrder;
      }
    }

    if (title !== undefined) chapter.title = title;
    if (description !== undefined) chapter.description = description;

    await chapter.save();
    req.flash("success", "Chapter updated successfully!");
    res.redirect(`/course/${chapter.courseId}`);
  },
);

// GET: Show edit form
app.get(
  "/page/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const page = await Page.findByPk(req.params.id);
    res.render("editPage", { page, csrfToken: req.csrfToken() });
  },
);

// PUT: Update page
app.put("/page/:id", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const page = await Page.findByPk(req.params.id);
  if (!page) {
    req.flash("error", "Page not found");
    return res.redirect("/course");
  }

  const chapter = await Chapter.findByPk(page.chapterId);
  if (!chapter) {
    req.flash("error", "Chapter not found");
    return res.redirect("/course");
  }

  const { title, content, order } = req.body;

  if (order !== undefined) {
    const parsedOrder = parseInt(order);
    if (!isNaN(parsedOrder)) {
      const exists = await Page.findOne({
        where: {
          chapterId: page.chapterId,
          order: parsedOrder,
          id: { [Op.ne]: page.id },
        },
      });

      if (exists) {
        req.flash(
          "error",
          `Order ${parsedOrder} already exists in this chapter`,
        );
        return res.redirect(`/page/${page.id}/edit`);
      }

      page.order = parsedOrder;
    }
  }

  if (title !== undefined) page.title = title;
  if (content !== undefined) page.content = content;

  await page.save();
  req.flash("success", "Page updated successfully!");
  res.redirect(`/course/${chapter.courseId}/chapter/${page.chapterId}`);
});

app.post(
  "/course/:id/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const course = await Course.findByPk(req.params.id);
      if (course && course.educatorId === req.user.id) {
        const chapters = await Chapter.findAll({
          where: { courseId: course.id },
        });
        for (const chapter of chapters) {
          await Page.destroy({ where: { chapterId: chapter.id } });
        }
        await Chapter.destroy({ where: { courseId: course.id } });
        await Enrollment.destroy({ where: { courseId: course.id } });
        await course.destroy();
      }
      req.flash("success", "Course deleted successfully!");
      res.redirect("/course");
    } catch (err) {
      console.error(err);
      req.flash("error", "An error occurred while deleting the course.");
      res.redirect("/course");
    }
  },
);

app.post(
  "/chapter/:id/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const chapter = await Chapter.findByPk(req.params.id);
      if (chapter) {
        const course = await Course.findByPk(chapter.courseId);
        if (course && course.educatorId === req.user.id) {
          await Page.destroy({ where: { chapterId: chapter.id } }); // delete pages
          await chapter.destroy(); // then delete chapter
        }
      }
      req.flash("success", "Chapter deleted successfully!");
      res.redirect(`/course/${chapter.courseId}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Error deleting chapter");
    }
  },
);

app.post(
  "/page/:id/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const page = await Page.findByPk(req.params.id);
      if (page) {
        const chapter = await Chapter.findByPk(page.chapterId);
        const course = await Course.findByPk(chapter.courseId);
        if (course && course.educatorId === req.user.id) {
          await page.destroy();
        }
      }
      const chapter = await Chapter.findByPk(page.chapterId);
      req.flash("success", "Page deleted successfully!");
      res.redirect(`/course/${chapter.courseId}/chapter/${page.chapterId}`);
    } catch (err) {
      console.log(err);
      res.status(500).send("Error deleting page");
    }
  },
);

app.post(
  "/completions/:pageId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const userId = req.user.id;
    const pageId = req.params.pageId;
    const page = await Page.findByPk(pageId);
    const chapterId = page.chapterId;
    const chapter = await Chapter.findByPk(chapterId);
    const courseId = chapter.courseId;

    try {
      const existing = await Completion.findOne({
        where: { userId, pageId },
      });

      if (!existing) {
        await Completion.create({
          userId,
          courseId,
          chapterId,
          pageId,
        });
      }

      res.redirect(
        `/mycourses/${courseId}/chapter/${chapterId}/page/${pageId}/view`,
      );
    } catch (error) {
      console.error("Error marking page as complete:", error);
      res.status(500).send("Internal Server Error");
    }
  },
);

app.get(
  "/educator/reports",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const educatorId = req.user.id;

    try {
      // Step 1: Get all educator's courses
      const courses = await Course.findAll({
        where: { educatorId },
        include: [
          {
            model: Enrollment,
            as: "courseEnrollments",
            attributes: ["studentId"],
          },
          {
            model: Chapter,
            as: "chapters",
            include: [
              {
                model: Page,
                as: "pages",
                attributes: ["id"],
              },
            ],
          },
        ],
      });

      // Step 2: Get all completions for those courses
      const courseIds = courses.map((c) => c.id);
      const completions = await Completion.findAll({
        where: {
          courseId: { [Op.in]: courseIds },
        },
        attributes: ["userId", "courseId", "pageId"],
      });

      // Step 3: Prepare final report data
      const reportData = courses.map((course) => {
        const courseId = course.id;
        const totalStudents = course.courseEnrollments.length;

        // Collect all page IDs for this course
        const allPageIds = course.chapters.flatMap((chapter) => {
          return chapter.pages?.map((p) => p.id) || [];
        });

        // Map: studentId => Set of completed pageIds
        const studentCompletions = {};
        completions
          .filter((c) => c.courseId === courseId)
          .forEach((c) => {
            if (!studentCompletions[c.userId])
              studentCompletions[c.userId] = new Set();
            studentCompletions[c.userId].add(c.pageId);
          });

        // Count students who completed all pages
        const completedStudents = Object.values(studentCompletions).filter(
          (pageSet) => allPageIds.every((pid) => pageSet.has(pid)),
        ).length;

        const completionPercentage =
          totalStudents > 0
            ? Math.round((completedStudents / totalStudents) * 100)
            : 0;

        return {
          title: course.title,
          totalStudents,
          completedStudents,
          completionPercentage,
        };
      });

      // Render
      res.render("educatorReport.ejs", { user: req.user, reportData });
    } catch (error) {
      console.error("Error generating educator report:", error);
      res.status(500).send("Internal Server Error");
    }
  },
);

app.get("/changepassword", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  try {
    res.render("changePassword.ejs", {
      csrfToken: req.csrfToken(),
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("Error rendering change password page:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post(
  "/changepassword",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    try {
      const user = await User.findByPk(req.user.id);

      // Check if current password is correct
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.render("changePassword", {
          error: "Current password is incorrect.",
          csrfToken: req.csrfToken(),
          success: null,
        });
      }

      // Check if new password matches confirmation
      if (newPassword !== confirmPassword) {
        return res.render("changePassword", {
          error: "New passwords do not match.",
          csrfToken: req.csrfToken(),
          success: null,
        });
      }

      // Check password length
      if (newPassword.length < 6) {
        return res.render("changePassword", {
          error: "New password must be at least 6 characters long.",
          csrfToken: req.csrfToken(),
          success: null,
        });
      }

      // All good — update password
      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      await user.save();

      req.flash("success", "Password changed successfully!");
      return res.redirect(`/dashboard`);
    } catch (error) {
      console.error(error);
      req.flash("error", "An error occurred while changing the password.");
      return res.redirect(`/changepassword`);
    }
  },
);

module.exports = app;
