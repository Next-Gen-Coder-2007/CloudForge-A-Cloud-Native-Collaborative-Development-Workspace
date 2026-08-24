import express from "express";

import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";

import {
  getWorkspace,
  getProjectFiles,
  createProjectFile,
  batchCreateProjectFiles,
  updateProjectFile,
  renameProjectFile,
  deleteProjectFile,
  getProjectCommits,
  getProjectCommitDetails,
  createProjectCommit,
  createOrSwitchBranch,
  mergeBranch,
  rollbackCommit,
} from "../controllers/workspaceController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Project CRUD
router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id", getProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

// Workspace & Files
router.get("/:id/workspace", getWorkspace);
router.get("/:id/files", getProjectFiles);
router.get("/:id/workspace/files", getProjectFiles);
router.post("/:id/files", createProjectFile);
router.post("/:id/workspace/files", createProjectFile);
router.post("/:id/files/batch", batchCreateProjectFiles);
router.post("/:id/workspace/files/batch", batchCreateProjectFiles);
router.put("/:id/files/:fileId", updateProjectFile);
router.put("/:id/workspace/files/:fileId", updateProjectFile);
router.put("/:id/files/:fileId/rename", renameProjectFile);
router.put("/:id/workspace/files/:fileId/rename", renameProjectFile);
router.delete("/:id/files/:fileId", deleteProjectFile);
router.delete("/:id/workspace/files/:fileId", deleteProjectFile);

// CloudForge Version Control System (VCS)
router.get("/:id/vcs/commits", getProjectCommits);
router.get("/:id/workspace/commits", getProjectCommits);
router.get("/:id/git/commits", getProjectCommits);
router.get("/:id/vcs/commits/:sha", getProjectCommitDetails);
router.get("/:id/workspace/commits/:sha", getProjectCommitDetails);
router.post("/:id/vcs/commit", createProjectCommit);
router.post("/:id/workspace/commits", createProjectCommit);
router.post("/:id/git/commit", createProjectCommit);
router.post("/:id/vcs/branches", createOrSwitchBranch);
router.post("/:id/workspace/branches", createOrSwitchBranch);
router.post("/:id/git/branches", createOrSwitchBranch);
router.post("/:id/vcs/merge", mergeBranch);
router.post("/:id/vcs/rollback/:sha", rollbackCommit);

export default router;