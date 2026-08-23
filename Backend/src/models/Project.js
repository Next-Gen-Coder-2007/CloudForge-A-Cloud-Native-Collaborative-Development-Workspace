import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    template: {
      type: String,
      enum: ["react", "nodejs", "python", "html-css", "java", "go", "blank"],
      default: "blank",
    },

    currentBranch: {
      type: String,
      default: "main",
      trim: true,
    },

    branches: {
      type: [String],
      default: ["main"],
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;