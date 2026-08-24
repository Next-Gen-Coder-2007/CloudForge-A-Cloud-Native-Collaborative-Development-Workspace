import mongoose from "mongoose";

const envVariableSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

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

    currentBranch: {
      type: String,
      default: "main",
      trim: true,
    },

    branches: {
      type: [String],
      default: ["main"],
    },

    envVariables: {
      type: [envVariableSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;