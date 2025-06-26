"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Users", "email", {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });

    await queryInterface.changeColumn("Users", "name", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("Users", "password", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("Users", "role", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert constraints (if needed)
    await queryInterface.changeColumn("Users", "email", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: false,
    });

    await queryInterface.changeColumn("Users", "name", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("Users", "password", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("Users", "role", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
