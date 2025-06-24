"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Page extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Chapter, {
        foreignKey: "chapterId",
        as: "chapter",
      });
      this.hasMany(models.Completion, {
        foreignKey: "pageId",
        onDelete: "CASCADE",
      });
    }
    static async getAllPages() {
      return await this.findAll();
    }
    static async getPagesByChapterId(chapterId) {
      return await this.findAll({
        where: { chapterId },
      });
    }
    static async findById(pageId) {
      return await this.findOne({
        where: { id: pageId },
      });
    }
  }
  Page.init(
    {
      title: DataTypes.STRING,
      content: DataTypes.TEXT,
      chapterId: DataTypes.INTEGER,
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "Page",
    },
  );
  return Page;
};
