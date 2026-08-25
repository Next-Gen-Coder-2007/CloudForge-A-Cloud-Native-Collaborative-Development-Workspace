import express from "express";
import {
  getContainerStatus,
  startContainer,
  stopContainer,
  restartContainer,
  rebuildContainer,
  syncWorkspaceFiles,
  executeCommand,
} from "../controllers/containerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get("/status", getContainerStatus);
router.post("/start", startContainer);
router.post("/stop", stopContainer);
router.post("/restart", restartContainer);
router.post("/rebuild", rebuildContainer);
router.post("/sync-files", syncWorkspaceFiles);
router.post("/exec", executeCommand);

export default router;
