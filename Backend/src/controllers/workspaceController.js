import crypto from "crypto";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";
import ProjectCommit from "../models/ProjectCommit.js";
import { getTemplateFiles } from "../services/templateService.js";
import {
  createCommit,
  switchBranch,
  mergeBranches,
  rollbackToCommit,
} from "../services/vcsService.js";

const detectLanguage = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "html":
    case "htm":
      return "html";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "java":
      return "java";
    case "go":
      return "go";
    case "cpp":
    case "c":
    case "h":
    case "hpp":
      return "cpp";
    case "sh":
    case "bash":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
};

/**
 * Get Workspace state and initialize template files if empty
 */
export const getWorkspace = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    let files = await ProjectFile.find({ projectId: project._id }).sort({
      path: 1,
    });

    // If workspace is empty, initialize default template files
    if (files.length === 0) {
      const templateFiles = getTemplateFiles(
        project.template || "blank",
        project.name
      );

      const docs = templateFiles.map((f) => ({
        ...f,
        projectId: project._id,
        size: Buffer.byteLength(f.content || "", "utf8"),
      }));

      files = await ProjectFile.insertMany(docs);

      // Create Initial Commit
      await createCommit({
        projectId: project._id,
        message: `Initial CloudForge commit: ${project.template || "blank"} project created`,
        branch: project.currentBranch || "main",
        author: {
          name: req.user.name || "CloudForge Developer",
          email: req.user.email || "developer@cloudforge.io",
        },
        files,
      });
    }

    const commits = await ProjectCommit.find({
      projectId: project._id,
      branch: project.currentBranch || "main",
    })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      project,
      files,
      commits,
      currentBranch: project.currentBranch || "main",
      branches: project.branches || ["main"],
    });
  } catch (error) {
    console.error("Get workspace error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load workspace", error: error.message });
  }
};

export const getProjectFiles = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const files = await ProjectFile.find({ projectId: project._id }).sort({
      path: 1,
    });

    return res.json({ files });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch files", error: error.message });
  }
};

export const createProjectFile = async (req, res) => {
  try {
    const { name, path: filePath, type = "file", content = "" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "File name is required" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const cleanName = name.trim();
    let normalizedPath = filePath ? filePath.trim() : `/${cleanName}`;
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }

    const existingFile = await ProjectFile.findOne({
      projectId: project._id,
      path: normalizedPath,
    });

    if (existingFile) {
      return res.status(400).json({
        message: `A ${existingFile.type} already exists at path '${normalizedPath}'`,
      });
    }

    const language = type === "file" ? detectLanguage(cleanName) : "plaintext";
    const size = Buffer.byteLength(content || "", "utf8");

    const newFile = await ProjectFile.create({
      projectId: project._id,
      name: cleanName,
      path: normalizedPath,
      type,
      content: type === "file" ? content : "",
      language,
      size,
    });

    project.updatedAt = new Date();
    await project.save();

    return res.status(201).json({
      message: `${type === "directory" ? "Folder" : "File"} '${cleanName}' created successfully`,
      file: newFile,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to create file", error: error.message });
  }
};

export const updateProjectFile = async (req, res) => {
  try {
    const { content } = req.body;
    const { fileId } = req.params;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const file = await ProjectFile.findOne({
      _id: fileId,
      projectId: project._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (file.type === "directory") {
      return res.status(400).json({ message: "Cannot edit directory content" });
    }

    file.content = content !== undefined ? content : file.content;
    file.size = Buffer.byteLength(file.content || "", "utf8");
    await file.save();

    project.updatedAt = new Date();
    await project.save();

    return res.json({
      message: "File updated successfully",
      file,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to update file", error: error.message });
  }
};

export const renameProjectFile = async (req, res) => {
  try {
    const { newName } = req.body;
    const { fileId } = req.params;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ message: "New name is required" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const file = await ProjectFile.findOne({
      _id: fileId,
      projectId: project._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const cleanNewName = newName.trim();
    const parentPath = file.path.substring(0, file.path.lastIndexOf("/"));
    const newPath = parentPath ? `${parentPath}/${cleanNewName}` : `/${cleanNewName}`;

    const duplicate = await ProjectFile.findOne({
      projectId: project._id,
      path: newPath,
      _id: { $ne: file._id },
    });

    if (duplicate) {
      return res.status(400).json({
        message: `An item named '${cleanNewName}' already exists at this location`,
      });
    }

    const oldPath = file.path;
    file.name = cleanNewName;
    file.path = newPath;
    if (file.type === "file") {
      file.language = detectLanguage(cleanNewName);
    }
    await file.save();

    // If directory, update children paths
    if (file.type === "directory") {
      const children = await ProjectFile.find({
        projectId: project._id,
        path: new RegExp(`^${oldPath}/`),
      });

      for (const child of children) {
        child.path = child.path.replace(oldPath, newPath);
        await child.save();
      }
    }

    project.updatedAt = new Date();
    await project.save();

    const allFiles = await ProjectFile.find({ projectId: project._id }).sort({
      path: 1,
    });

    return res.json({
      message: "Renamed successfully",
      file,
      files: allFiles,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to rename file", error: error.message });
  }
};

export const deleteProjectFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const file = await ProjectFile.findOne({
      _id: fileId,
      projectId: project._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (file.type === "directory") {
      await ProjectFile.deleteMany({
        projectId: project._id,
        path: new RegExp(`^${file.path}(/|$)`),
      });
    } else {
      await ProjectFile.findByIdAndDelete(file._id);
    }

    project.updatedAt = new Date();
    await project.save();

    const files = await ProjectFile.find({ projectId: project._id }).sort({
      path: 1,
    });

    return res.json({
      message: `Deleted '${file.name}' successfully`,
      files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete file", error: error.message });
  }
};

/* ========================================================================= */
/*                   CloudForge VCS (Version Control System)                 */
/* ========================================================================= */

/**
 * Get Commits History
 */
export const getProjectCommits = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const commits = await ProjectCommit.find({
      projectId: project._id,
      branch: project.currentBranch || "main",
    })
      .sort({ createdAt: -1 })
      .limit(60);

    return res.json({ commits });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch commits", error: error.message });
  }
};

/**
 * Get details for a specific Commit SHA
 */
export const getProjectCommitDetails = async (req, res) => {
  try {
    const { sha } = req.params;
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const commit = await ProjectCommit.findOne({
      projectId: project._id,
      sha,
    });

    if (!commit) {
      return res.status(404).json({ message: "Commit not found" });
    }

    return res.json({ commit });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch commit details", error: error.message });
  }
};

/**
 * Create a new Commit Snapshot in CloudForge VCS
 */
export const createProjectCommit = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Commit message is required" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const currentFiles = await ProjectFile.find({ projectId: project._id });

    const commit = await createCommit({
      projectId: project._id,
      message: message.trim(),
      branch: project.currentBranch || "main",
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
      files: currentFiles,
    });

    project.updatedAt = new Date();
    await project.save();

    return res.status(201).json({
      message: `Commit ${commit.sha} created successfully in CloudForge VCS`,
      commit,
    });
  } catch (error) {
    console.error("Create commit error:", error);
    return res
      .status(500)
      .json({ message: "Failed to create commit", error: error.message });
  }
};

/**
 * Create or Switch Branch in CloudForge VCS
 */
export const createOrSwitchBranch = async (req, res) => {
  try {
    const { branch, branchName, createNew = false } = req.body;
    const targetBranch = branch || branchName;

    if (!targetBranch || !targetBranch.trim()) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    const cleanBranch = targetBranch.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-");

    const result = await switchBranch({
      projectId: req.params.id,
      branchName: cleanBranch,
    });

    return res.json({
      message: `Switched to branch '${cleanBranch}'`,
      currentBranch: result.project.currentBranch,
      branches: result.project.branches,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to switch branch", error: error.message });
  }
};

/**
 * Merge Branches in CloudForge VCS
 */
export const mergeBranch = async (req, res) => {
  try {
    const { sourceBranch, targetBranch } = req.body;

    if (!sourceBranch || !targetBranch) {
      return res.status(400).json({ message: "sourceBranch and targetBranch are required" });
    }

    const result = await mergeBranches({
      projectId: req.params.id,
      sourceBranch,
      targetBranch,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.json({
      message: `Successfully merged '${sourceBranch}' into '${targetBranch}'`,
      mergeCommit: result.mergeCommit,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to merge branches", error: error.message });
  }
};

/**
 * Time Travel: Rollback workspace to a historical commit snapshot
 */
export const rollbackCommit = async (req, res) => {
  try {
    const { sha } = req.params;
    if (!sha) {
      return res.status(400).json({ message: "Commit SHA is required" });
    }

    const result = await rollbackToCommit({
      projectId: req.params.id,
      sha,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.json({
      message: `Workspace reverted to commit ${sha.substring(0, 7)} successfully`,
      revertedCommit: result.revertedCommit,
      newCommit: result.newCommit,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to rollback commit", error: error.message });
  }
};

/**
 * Reset Workspace to Template preset
 */
export const resetWorkspaceTemplate = async (req, res) => {
  try {
    const { template } = req.body;
    if (!template) {
      return res
        .status(400)
        .json({ message: "Template preset name is required" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await ProjectFile.deleteMany({ projectId: project._id });

    const templateFiles = getTemplateFiles(template, project.name);
    const docs = templateFiles.map((f) => ({
      ...f,
      projectId: project._id,
      size: Buffer.byteLength(f.content || "", "utf8"),
    }));
    const newFiles = await ProjectFile.insertMany(docs);

    const initialCommit = await createCommit({
      projectId: project._id,
      message: `Reset workspace to '${template}' preset`,
      branch: project.currentBranch || "main",
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
      files: newFiles,
    });

    project.template = template;
    await project.save();

    const commits = await ProjectCommit.find({
      projectId: project._id,
      branch: project.currentBranch || "main",
    })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      message: `Workspace reset to ${template} template successfully`,
      project,
      files: newFiles,
      commits,
    });
  } catch (error) {
    console.error("Reset template error:", error);
    return res
      .status(500)
      .json({ message: "Failed to reset template", error: error.message });
  }
};
