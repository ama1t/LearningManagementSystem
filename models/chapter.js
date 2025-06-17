"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Chapter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
      this.hasMany(models.Page, {
        foreignKey: "chapterId",
        as: "pages",
      });
      this.hasMany(models.Completion, {
        foreignKey: "chapterId",
        onDelete: "CASCADE",
      });
    }
    static async getallChapters() {
      return await this.findAll();
    }
    static async getChapterByCourseId(courseId) {
      return await this.findAll({
        where: { courseId },
      });
    }
    static async createChapter(title, description, courseId) {
      return await this.create({
        title: title,
        description: description,
        courseId: courseId,
      });
    }
    static async findById(chapterId) {
      return await this.findOne({
        where: { id: chapterId },
      });
    }
  }
  Chapter.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      courseId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Chapter",
    },
  );
  return Chapter;
};
