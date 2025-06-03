"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.renameColumn("Enrollments", "userId", "studentId");

    await queryInterface.addConstraint("Enrollments", {
      fields: ["studentId"],
      type: "foreign key",
      name: "fk_enrollment_studentId",
      references: {
        table: "Users",
        field: "id",
      },
      onDelete: "cascade",
      onUpdate: "cascade",
    });
    await queryInterface.addConstraint("Enrollments", {
      fields: ["courseId"],
      type: "foreign key",
      name: "fk_enrollment_courseId",
      references: {
        table: "Courses",
        field: "id",
      },
      onDelete: "cascade",
      onUpdate: "cascade",
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeConstraint(
      "Enrollments",
      "fk_enrollment_studentId",
    );
    await queryInterface.removeConstraint(
      "Enrollments",
      "fk_enrollment_courseId",
    );
    await queryInterface.renameColumn("Enrollments", "studentId", "userId");
  },
};
