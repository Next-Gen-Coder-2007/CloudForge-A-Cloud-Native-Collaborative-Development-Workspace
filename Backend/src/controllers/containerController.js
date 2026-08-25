import containerService from "../services/containerService.js";
import cloudRunnerService from "../services/cloudRunnerService.js";
import terminalGateway from "../services/terminalGateway.js";
import Project from "../models/Project.js";

/**
 * @desc    Get live container, Docker daemon, and Cloud Runner API status for a project
 * @route   GET /api/projects/:id/container/status
 * @access  Private
 */
export const getContainerStatus = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }

    const dockerStatus = await containerService.getDockerStatus();
    const container = await containerService.getProjectContainer(projectId);
    const cloudRunner = await cloudRunnerService.getCloudRunnerStatus();

    res.json({
      success: true,
      docker: dockerStatus,
      container,
      cloudRunner,
    });
  } catch (err) {
    console.error("getContainerStatus error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Start / provision dedicated container for a project
 * @route   POST /api/projects/:id/container/start
 * @access  Private
 */
export const startContainer = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }

    const result = await containerService.startProjectContainer(projectId, req.body.env || {});
    const containerInfo = await containerService.getProjectContainer(projectId);
    terminalGateway.broadcastContainerStatus(projectId, containerInfo);

    res.json({
      success: true,
      result,
      container: containerInfo,
    });
  } catch (err) {
    console.error("startContainer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Stop project container
 * @route   POST /api/projects/:id/container/stop
 * @access  Private
 */
export const stopContainer = async (req, res) => {
  try {
    const projectId = req.params.id;
    const result = await containerService.stopProjectContainer(projectId);
    const containerInfo = await containerService.getProjectContainer(projectId);
    terminalGateway.broadcastContainerStatus(projectId, containerInfo);

    res.json({
      success: true,
      result,
      container: containerInfo,
    });
  } catch (err) {
    console.error("stopContainer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Restart project container
 * @route   POST /api/projects/:id/container/restart
 * @access  Private
 */
export const restartContainer = async (req, res) => {
  try {
    const projectId = req.params.id;
    const result = await containerService.restartProjectContainer(projectId);
    const containerInfo = await containerService.getProjectContainer(projectId);
    terminalGateway.broadcastContainerStatus(projectId, containerInfo);

    res.json({
      success: true,
      result,
      container: containerInfo,
    });
  } catch (err) {
    console.error("restartContainer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Rebuild container (force delete and recreate clean container)
 * @route   POST /api/projects/:id/container/rebuild
 * @access  Private
 */
export const rebuildContainer = async (req, res) => {
  try {
    const projectId = req.params.id;
    await containerService.deleteProjectContainer(projectId);
    const result = await containerService.startProjectContainer(projectId);
    const containerInfo = await containerService.getProjectContainer(projectId);
    terminalGateway.broadcastContainerStatus(projectId, containerInfo);

    res.json({
      success: true,
      result,
      container: containerInfo,
    });
  } catch (err) {
    console.error("rebuildContainer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Sync latest MongoDB project files to container disk workspace
 * @route   POST /api/projects/:id/container/sync-files
 * @access  Private
 */
export const syncWorkspaceFiles = async (req, res) => {
  try {
    const projectId = req.params.id;
    const result = await containerService.syncFilesToWorkspace(projectId);

    res.json({
      success: true,
      message: `Synchronized ${result.syncedCount} files into workspace.`,
      result,
    });
  } catch (err) {
    console.error("syncWorkspaceFiles error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Execute non-interactive command inside project container
 * @route   POST /api/projects/:id/container/exec
 * @access  Private
 */
export const executeCommand = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, message: "command string is required." });
    }

    const result = await containerService.execCommand(projectId, command, {
      env: req.body.env || {},
    });

    res.json({
      success: true,
      result,
    });
  } catch (err) {
    console.error("executeCommand error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
