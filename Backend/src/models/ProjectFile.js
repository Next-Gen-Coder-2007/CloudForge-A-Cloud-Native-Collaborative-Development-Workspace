import mongoose from "mongoose";

const projectFileSchema = new mongoose.Schema(
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
    path: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["file", "directory"],
      default: "file",
    },
    content: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "plaintext",
    },
    mimeType: {
      type: String,
      default: "text/plain",
    },
    size: {
      type: Number,
      default: 0,
    },
    sha: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

projectFileSchema.index({ projectId: 1, path: 1 }, { unique: true });

const ProjectFile = mongoose.model("ProjectFile", projectFileSchema);

export default ProjectFile;
