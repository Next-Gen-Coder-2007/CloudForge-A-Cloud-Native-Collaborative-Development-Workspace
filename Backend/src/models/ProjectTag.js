import mongoose from "mongoose";

const projectTagSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sha: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    author: {
      name: {
        type: String,
        default: "Developer",
      },
      email: {
        type: String,
        default: "developer@cloudforge.io",
      },
    },
  },
  {
    timestamps: true,
  }
);

projectTagSchema.index({ projectId: 1, name: 1 }, { unique: true });

const ProjectTag = mongoose.model("ProjectTag", projectTagSchema);

export default ProjectTag;
