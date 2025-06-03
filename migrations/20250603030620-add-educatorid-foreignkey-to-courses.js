"use strict";

/** @type {import('sequelize-cli').Migration} */
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Only add the foreign key constraint
    await queryInterface.addConstraint("Courses", {
      fields: ["educatorId"],
      type: "foreign key",
      name: "fk_courses_educatorId", // custom constraint name
      references: {
        table: "Users",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("Courses", "fk_courses_educatorId");
  },
};
