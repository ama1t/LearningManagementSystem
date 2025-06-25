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
    await queryInterface.addConstraint("Chapters", {
      fields: ["courseId", "order"],
      type: "unique",
      name: "unique_order_per_course",
    });
    await queryInterface.addConstraint("Pages", {
      fields: ["chapterId", "order"],
      type: "unique",
      name: "unique_order_per_chapter",
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
      "Chapters",
      "unique_order_per_course",
    );
    await queryInterface.removeConstraint("Pages", "unique_order_per_chapter");
  },
};
