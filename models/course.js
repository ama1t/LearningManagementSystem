"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }

    static async findByEducatorId(educatorId) {
      return await this.findAll({
        where: { educatorId },
      });
    }
    static async findById(courseId) {
      return await this.findOne({
        where: { id: courseId },
      });
    }
    static async createCourse(title, description, imageUrl, educatorId) {
      return await this.create({
        title: title,
        description: description,
        educatorId: educatorId,
        imageUrl: imageUrl,
      });
    }
    static async updateCourse(courseId, courseData) {
      const course = await this.findById(courseId);
      if (course) {
        return await course.update(courseData);
      }
      throw new Error("Course not found");
    }
    static async deleteCourse(courseId) {
      const course = await this.findById(courseId);
      if (course) {
        return await course.destroy();
      }
      throw new Error("Course not found");
    }
    static async getAllCourses() {
      return await this.findAll();
    }
  }
  Course.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      educatorId: DataTypes.INTEGER,
      imageUrl: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Course",
    },
  );
  return Course;
};
