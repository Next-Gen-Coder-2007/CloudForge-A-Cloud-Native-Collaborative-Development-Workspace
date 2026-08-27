import express from "express";
import { executeCode, getKernelStatus, restartKernel } from "../controllers/kernelController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post("/execute", executeCode);
router.get("/status", getKernelStatus);
router.post("/restart", restartKernel);

export default router;
