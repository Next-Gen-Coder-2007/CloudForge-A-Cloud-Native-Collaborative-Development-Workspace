import mongoose from "mongoose";

const stashFileSnapshotSchema = new mongoose.Schema(
  {
    path: String,
    name: String,
    content: String,
    language: String,
    type: { type: String, default: "file" },
    size: Number,
  },
  { _id: false }
);

const projectStashSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    stashIndex: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      default: "WIP on branch",
      trim: true,
    },
    branch: {
      type: String,
      default: "main",
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
    filesSnapshot: [stashFileSnapshotSchema],
  },
  {
    timestamps: true,
  }
);

projectStashSchema.index({ projectId: 1, createdAt: -1 });

const ProjectStash = mongoose.model("ProjectStash", projectStashSchema);

export default ProjectStash;
