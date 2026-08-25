import express from "express";
import {
  getPreviewInfo,
  startDevServer,
  stopDevServer,
  proxyPreview,
} from "../controllers/previewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Management endpoints (Authenticated)
router.get("/info", protect, getPreviewInfo);
router.post("/start", protect, startDevServer);
router.post("/stop", protect, stopDevServer);

// Public / Iframe Proxy endpoints (Matches /:port and all subpaths)
router.use("/:port", proxyPreview);

export default router;
