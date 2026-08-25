import crypto from "crypto";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";
import ProjectCommit from "../models/ProjectCommit.js";
import ProjectTag from "../models/ProjectTag.js";
import ProjectStash from "../models/ProjectStash.js";
import {
  createCommit,
  switchBranch,
  mergeBranches,
  finalizeMergeWithResolutions,
  cherryPickCommit,
  revertCommit,
  saveStash,
  getStashes,
  applyStash,
  popStash,
  dropStash,
  createTag,
  getTags,
  deleteTag,
  getFileBlame,
  getFileHistory,
  compareSnapshots,
  deleteBranch,
  renameBranch,
  rollbackToCommit,
} from "../services/vcsService.js";
import containerService from "../services/containerService.js";

const computeContentSize = (content) => {
  if (!content) return 0;
  if (typeof content === "string" && content.startsWith("data:")) {
    const base64Str = content.split(",")[1] || "";
    return Math.round((base64Str.length * 3) / 4);
  }
  return Buffer.byteLength(content, "utf8");
};

export const detectMimeType = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "bmp":
      return "image/bmp";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "csv":
      return "text/csv";
    case "tsv":
      return "text/tab-separated-values";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
    case "ppsx":
      return "application/vnd.ms-powerpoint";
    case "tex":
    case "latex":
      return "application/x-tex";
    case "mermaid":
    case "mmd":
      return "text/x-mermaid";
    case "md":
    case "markdown":
      return "text/markdown";
    case "json":
      return "application/json";
    case "html":
    case "htm":
      return "text/html";
    case "css":
    case "scss":
    case "less":
      return "text/css";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "application/javascript";
    case "ts":
    case "tsx":
      return "application/typescript";
    case "py":
      return "text/x-python";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "mp4":
      return "video/mp4";
    case "zip":
      return "application/zip";
    default:
      return "text/plain";
  }
};

export const detectLanguage = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "pdf";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
    case "bmp":
    case "ico":
    case "avif":
      return "image";
    case "xlsx":
    case "xls":
      return "spreadsheet";
    case "docx":
    case "doc":
      return "word";
    case "pptx":
    case "ppt":
    case "ppsx":
      return "powerpoint";
    case "csv":
      return "csv";
    case "tsv":
      return "tsv";
    case "tex":
    case "latex":
    case "bib":
    case "sty":
    case "cls":
      return "latex";
    case "mermaid":
    case "mmd":
      return "mermaid";
    case "md":
    case "markdown":
      return "markdown";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
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
    case "java":
      return "java";
    case "go":
      return "go";
    case "cpp":
    case "c":
    case "h":
    case "hpp":
    case "cc":
      return "cpp";
    case "rs":
      return "rust";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    case "cs":
      return "csharp";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "xml":
      return "xml";
    case "toml":
      return "toml";
    case "mp3":
    case "wav":
    case "ogg":
      return "audio";
    case "mp4":
    case "webm":
      return "video";
    default:
      return "plaintext";
  }
};

/**
 * Get Workspace state and files
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

    const files = await ProjectFile.find({ projectId: project._id }).sort({
      path: 1,
    });

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
    const { name, path: filePath, type = "file", content = "", overwrite = false } = req.body;

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

    const language = type === "file" ? detectLanguage(cleanName) : "plaintext";
    const mimeType = type === "file" ? detectMimeType(cleanName) : "inode/directory";
    const size = type === "file" ? computeContentSize(content || "") : 0;

    if (existingFile) {
      if (overwrite) {
        existingFile.name = cleanName;
        existingFile.type = type;
        existingFile.content = type === "file" ? content : "";
        existingFile.language = language;
        existingFile.mimeType = mimeType;
        existingFile.size = size;
        await existingFile.save();

        project.updatedAt = new Date();
        await project.save();

        return res.status(200).json({
          message: `${type === "directory" ? "Folder" : "File"} '${cleanName}' updated successfully`,
          file: existingFile,
        });
      }

      return res.status(400).json({
        message: `A ${existingFile.type} already exists at path '${normalizedPath}'`,
      });
    }

    const newFile = await ProjectFile.create({
      projectId: project._id,
      name: cleanName,
      path: normalizedPath,
      type,
      content: type === "file" ? content : "",
      language,
      mimeType,
      size,
    });

    project.updatedAt = new Date();
    await project.save();

    // Asynchronously synchronize new file to disk workspace
    if (newFile.type === "file") {
      containerService.syncSingleFile(project._id, newFile.path, newFile.content).catch(() => {});
    }

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

/**
 * Batch upload / create multiple files and folders in a single atomic request
 */
export const batchCreateProjectFiles = async (req, res) => {
  try {
    const { files = [] } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "Files array is required and must not be empty" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const createdOrUpdated = [];

    for (const item of files) {
      const cleanName = (item.name || "").trim();
      if (!cleanName) continue;

      let normalizedPath = item.path ? item.path.trim() : `/${cleanName}`;
      if (!normalizedPath.startsWith("/")) {
        normalizedPath = "/" + normalizedPath;
      }

      const itemType = item.type === "directory" ? "directory" : "file";
      const language = itemType === "file" ? detectLanguage(cleanName) : "plaintext";
      const mimeType = itemType === "file" ? detectMimeType(cleanName) : "inode/directory";
      const size = itemType === "file" ? computeContentSize(item.content || "") : 0;

      const existing = await ProjectFile.findOne({
        projectId: project._id,
        path: normalizedPath,
      });

      if (existing) {
        existing.content = itemType === "file" ? item.content || "" : "";
        existing.language = language;
        existing.mimeType = mimeType;
        existing.size = size;
        await existing.save();
        createdOrUpdated.push(existing);
      } else {
        const newDoc = await ProjectFile.create({
          projectId: project._id,
          name: cleanName,
          path: normalizedPath,
          type: itemType,
          content: itemType === "file" ? item.content || "" : "",
          language,
          mimeType,
          size,
        });
        createdOrUpdated.push(newDoc);
      }
    }

    project.updatedAt = new Date();
    await project.save();

    const allFiles = await ProjectFile.find({ projectId: project._id }).sort({ path: 1 });

    return res.status(201).json({
      message: `Successfully processed ${createdOrUpdated.length} files/folders`,
      processedCount: createdOrUpdated.length,
      files: allFiles,
    });
  } catch (error) {
    console.error("Batch upload error:", error);
    return res.status(500).json({ message: "Batch file creation failed", error: error.message });
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

    // Asynchronously synchronize file update to disk workspace
    containerService.syncSingleFile(project._id, file.path, file.content).catch(() => {});

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
 * Get Commits History (Supports branch filtering)
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

    const branch = req.query.branch || project.currentBranch || "main";

    const commits = await ProjectCommit.find({
      projectId: project._id,
      branch,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ commits, branch });
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
 * Create a new Commit Snapshot in CloudForge VCS (Supports selective staged staging)
 */
export const createProjectCommit = async (req, res) => {
  try {
    const { message, stagedFiles = null } = req.body;

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
      stagedFiles,
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
      createNew,
    });

    return res.json({
      message: `Switched to branch '${cleanBranch}'`,
      currentBranch: result.project.currentBranch,
      branches: result.project.branches,
      files: result.files,
      headCommit: result.headCommit,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to switch branch", error: error.message });
  }
};

/**
 * Delete a Branch
 */
export const deleteProjectBranch = async (req, res) => {
  try {
    const { branchName } = req.params;
    const result = await deleteBranch({
      projectId: req.params.id,
      branchName,
    });

    return res.json({
      message: `Deleted branch '${branchName}'`,
      branches: result.branches,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete branch", error: error.message });
  }
};

/**
 * Rename a Branch
 */
export const renameProjectBranch = async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ message: "oldName and newName are required" });
    }

    const result = await renameBranch({
      projectId: req.params.id,
      oldBranchName: oldName,
      newBranchName: newName,
    });

    return res.json({
      message: `Renamed branch '${oldName}' to '${newName}'`,
      currentBranch: result.currentBranch,
      branches: result.branches,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to rename branch", error: error.message });
  }
};

/**
 * 3-Way Merge Branches in CloudForge VCS (With Conflict Detection)
 */
export const mergeBranch = async (req, res) => {
  try {
    const { sourceBranch, targetBranch, dryRun = false } = req.body;

    if (!sourceBranch || !targetBranch) {
      return res.status(400).json({ message: "sourceBranch and targetBranch are required" });
    }

    const result = await mergeBranches({
      projectId: req.params.id,
      sourceBranch,
      targetBranch,
      dryRun,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    if (result.hasConflicts) {
      return res.status(409).json({
        message: `Merge conflict detected between '${sourceBranch}' and '${targetBranch}'`,
        hasConflicts: true,
        conflictFiles: result.conflictFiles,
        cleanMergedFiles: result.cleanMergedFiles,
        sourceBranch,
        targetBranch,
        sourceHeadSha: result.sourceHeadSha,
        targetHeadSha: result.targetHeadSha,
        baseSha: result.baseSha,
      });
    }

    return res.json({
      message: `Successfully merged '${sourceBranch}' into '${targetBranch}'`,
      hasConflicts: false,
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
 * Finalize Merge with Manual Resolutions
 */
export const finalizeMergeConflict = async (req, res) => {
  try {
    const { sourceBranch, targetBranch, resolvedFiles, customMessage } = req.body;

    if (!sourceBranch || !targetBranch || !resolvedFiles) {
      return res.status(400).json({ message: "sourceBranch, targetBranch, and resolvedFiles are required" });
    }

    const result = await finalizeMergeWithResolutions({
      projectId: req.params.id,
      sourceBranch,
      targetBranch,
      resolvedFiles,
      customMessage,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.json({
      message: `Conflict resolved & merged '${sourceBranch}' into '${targetBranch}'`,
      mergeCommit: result.mergeCommit,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to finalize merge resolution", error: error.message });
  }
};

/**
 * Cherry-Pick a Commit
 */
export const cherryPickCommitHandler = async (req, res) => {
  try {
    const { sha } = req.params;
    const { targetBranch } = req.body;

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await cherryPickCommit({
      projectId: project._id,
      sha,
      targetBranch: targetBranch || project.currentBranch || "main",
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.json({
      message: `Successfully cherry-picked commit ${sha.substring(0, 7)}`,
      cherryPickCommit: result.cherryPickCommit,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to cherry-pick commit", error: error.message });
  }
};

/**
 * Revert a Commit
 */
export const revertCommitHandler = async (req, res) => {
  try {
    const { sha } = req.params;
    const { targetBranch } = req.body;

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await revertCommit({
      projectId: project._id,
      sha,
      targetBranch: targetBranch || project.currentBranch || "main",
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.json({
      message: `Successfully reverted commit ${sha.substring(0, 7)}`,
      revertedCommit: result.revertedCommit,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to revert commit", error: error.message });
  }
};

/**
 * Save Workspace Stash
 */
export const saveProjectStash = async (req, res) => {
  try {
    const { message } = req.body;
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const currentFiles = await ProjectFile.find({ projectId: project._id });

    const result = await saveStash({
      projectId: project._id,
      branch: project.currentBranch || "main",
      message,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
      files: currentFiles,
    });

    return res.json({
      message: "Working tree stashed successfully",
      stash: result.stash,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to save stash", error: error.message });
  }
};

/**
 * Get All Stashes
 */
export const getProjectStashes = async (req, res) => {
  try {
    const stashes = await getStashes({ projectId: req.params.id });
    return res.json({ stashes });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch stashes", error: error.message });
  }
};

/**
 * Apply Stash
 */
export const applyProjectStash = async (req, res) => {
  try {
    const { stashId } = req.params;
    const result = await applyStash({ projectId: req.params.id, stashId });
    return res.json({
      message: "Stash applied successfully",
      stash: result.stash,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to apply stash", error: error.message });
  }
};

/**
 * Pop Stash
 */
export const popProjectStash = async (req, res) => {
  try {
    const { stashId } = req.params;
    const result = await popStash({ projectId: req.params.id, stashId });
    return res.json({
      message: "Stash popped and restored successfully",
      stash: result.stash,
      files: result.files,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to pop stash", error: error.message });
  }
};

/**
 * Drop Stash
 */
export const dropProjectStash = async (req, res) => {
  try {
    const { stashId } = req.params;
    await dropStash({ projectId: req.params.id, stashId });
    return res.json({ message: "Stash dropped successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to drop stash", error: error.message });
  }
};

/**
 * Create Tag
 */
export const createProjectTag = async (req, res) => {
  try {
    const { name, sha, message } = req.body;
    if (!name || !sha) {
      return res.status(400).json({ message: "name and sha are required" });
    }

    const tag = await createTag({
      projectId: req.params.id,
      name,
      sha,
      message,
      author: {
        name: req.user.name || "CloudForge Developer",
        email: req.user.email || "developer@cloudforge.io",
      },
    });

    return res.status(201).json({ message: `Tag '${tag.name}' created`, tag });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to create tag", error: error.message });
  }
};

/**
 * Get Tags
 */
export const getProjectTags = async (req, res) => {
  try {
    const tags = await getTags({ projectId: req.params.id });
    return res.json({ tags });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch tags", error: error.message });
  }
};

/**
 * Delete Tag
 */
export const deleteProjectTag = async (req, res) => {
  try {
    const { name } = req.params;
    await deleteTag({ projectId: req.params.id, name });
    return res.json({ message: `Tag '${name}' deleted` });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete tag", error: error.message });
  }
};

/**
 * Get File Blame
 */
export const getProjectFileBlame = async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ message: "File path query parameter is required" });
    }

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const blame = await getFileBlame({
      projectId: project._id,
      path,
      branch: project.currentBranch || "main",
    });

    return res.json({ path, blame });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to compute file blame", error: error.message });
  }
};

/**
 * Get File Commit History
 */
export const getProjectFileHistory = async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ message: "File path query parameter is required" });
    }

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const history = await getFileHistory({
      projectId: project._id,
      path,
      branch: project.currentBranch || "main",
    });

    return res.json({ path, history });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch file history", error: error.message });
  }
};

/**
 * Compare Arbitrary Branches or Commits
 */
export const compareProjectSnapshots = async (req, res) => {
  try {
    const { base, head } = req.query;
    if (!base || !head) {
      return res.status(400).json({ message: "base and head query parameters are required" });
    }

    const comparison = await compareSnapshots({
      projectId: req.params.id,
      base,
      head,
    });

    return res.json({ comparison });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to compare snapshots", error: error.message });
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
