"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Completion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Completion.belongsTo(models.User, { foreignKey: "userId" });
      Completion.belongsTo(models.Course, { foreignKey: "courseId" });
      Completion.belongsTo(models.Chapter, { foreignKey: "chapterId" });
      Completion.belongsTo(models.Page, { foreignKey: "pageId" });
    }
  }
  Completion.init(
    {
      userId: DataTypes.INTEGER,
      courseId: DataTypes.INTEGER,
      chapterId: DataTypes.INTEGER,
      pageId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Completion",
    },
  );
  return Completion;
};
