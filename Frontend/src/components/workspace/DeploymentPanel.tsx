import React, { useState, useEffect, useCallback } from "react";
import {
  Rocket,
  ExternalLink,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Copy,
  Check,
  RotateCw,
  Globe,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../hooks/useAlert";
import {
  deployService,
  type DeploymentRecord,
  type DeploymentLog,
} from "../../services/deployService";

interface DeploymentPanelProps {
  projectId: string;
  projectName?: string;
}

export const DeploymentPanel: React.FC<DeploymentPanelProps> = ({
  projectId,
  projectName = "Project",
}) => {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useAlert();

  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active inspected logs
  const [selectedDeployId, setSelectedDeployId] = useState<string | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Custom build settings dropdown
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  const [customBuildCommand, setCustomBuildCommand] = useState("");
  const [customOutputDir, setCustomOutputDir] = useState("");

  const loadDeployments = useCallback(async () => {
    try {
      const data = await deployService.listDeployments(projectId);
      setDeployments(data.deployments || []);
      // Auto-poll if any deployment is queued or building
      const hasActive = data.deployments?.some(
        (d) => d.status === "queued" || d.status === "building"
      );
      if (hasActive) {
        setTimeout(loadDeployments, 2500);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDeployments();
  }, [loadDeployments]);

  const handleStartDeploy = async () => {
    setDeploying(true);
    try {
      const options: { buildCommand?: string; outputDir?: string } = {};
      if (customBuildCommand.trim()) options.buildCommand = customBuildCommand.trim();
      if (customOutputDir.trim()) options.outputDir = customOutputDir.trim();

      const res = await deployService.startDeployment(projectId, options);
      showSuccess(res.message || "Deployment initiated!");
      setSelectedDeployId(res.deployment.deployId);
      loadDeployments();
    } catch (err: any) {
      showError(err.message || "Failed to trigger deployment.");
    } finally {
      setDeploying(false);
    }
  };

  const handleRedeploy = async (deployId: string) => {
    try {
      const res = await deployService.redeploy(projectId, deployId);
      showSuccess(res.message || "Redeployment triggered!");
      loadDeployments();
    } catch (err: any) {
      showError(err.message || "Redeploy failed.");
    }
  };

  const handleDelete = async (deployId: string) => {
    if (!confirm("Are you sure you want to delete this deployment?")) return;
    try {
      await deployService.deleteDeployment(projectId, deployId);
      showSuccess("Deployment removed.");
      setDeployments((prev) => prev.filter((d) => d.deployId !== deployId));
    } catch (err: any) {
      showError(err.message || "Delete failed.");
    }
  };

  const handleViewLogs = async (deployId: string) => {
    setSelectedDeployId(deployId);
    setLoadingLogs(true);
    setShowLogsModal(true);
    try {
      const res = await deployService.getDeploymentLogs(projectId, deployId);
      setLogs(res.logs || []);
    } catch (err: any) {
      showError(err.message || "Could not load build logs.");
    } finally {
      setLoadingLogs(false);
    }
  };

  const copyUrl = (deployId: string) => {
    const url = deployService.getSiteUrl(projectId, deployId);
    navigator.clipboard.writeText(url);
    setCopiedId(deployId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentDeployment = deployments.find((d) => d.isCurrent && d.status === "ready");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        );
      case "building":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <RotateCw className="w-3 h-3 animate-spin" /> Building
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/10 text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 text-neutral-200" : "bg-neutral-50 text-neutral-800"
      }`}
    >
      {/* Panel Header */}
      <div
        className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between ${
          isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-white border-neutral-200"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Rocket className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="font-bold text-[11px] uppercase tracking-wider truncate">
            Deployment {projectName ? `• ${projectName}` : ""}
          </span>
        </div>
        <button
          onClick={loadDeployments}
          className={`p-1 rounded transition-colors ${
            isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-200 text-neutral-600"
          }`}
          title="Refresh deployments"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live Production URL Card */}
        {currentDeployment ? (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isDark
                ? "bg-gradient-to-br from-emerald-950/20 via-neutral-900 to-neutral-900/80 border-emerald-500/30"
                : "bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                <Globe className="w-3.5 h-3.5" />
                <span>Live Production Site</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400">
                {currentDeployment.deployId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={deployService.getSiteUrl(projectId, currentDeployment.deployId)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate font-mono text-[11px] text-blue-400 hover:underline flex items-center gap-1 bg-black/20 p-2 rounded-lg border border-neutral-800/60"
              >
                <span className="truncate">{deployService.getSiteUrl(projectId, currentDeployment.deployId)}</span>
                <ExternalLink className="w-3 h-3 shrink-0 ml-auto opacity-70" />
              </a>
              <button
                onClick={() => copyUrl(currentDeployment.deployId)}
                className={`p-2 rounded-lg border transition-colors shrink-0 ${
                  isDark
                    ? "bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-300"
                    : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Copy public URL"
              >
                {copiedId === currentDeployment.deployId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        {/* Deploy Action Card */}
        <div
          className={`p-4 rounded-xl border ${
            isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-white border-neutral-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-xs text-inherit">One-Click Production Deploy</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Builds artifacts and publishes an immutable static site.
              </p>
            </div>
          </div>

          {/* Optional Custom Build Settings Accordion */}
          <div className="mb-3">
            <button
              onClick={() => setShowCustomSettings(!showCustomSettings)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 font-medium transition-colors"
            >
              <Layers className="w-3 h-3" />
              <span>Override Build & Output Settings</span>
              {showCustomSettings ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5" />
              )}
            </button>

            {showCustomSettings && (
              <div className="mt-2.5 space-y-2 p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1">
                    Build Command
                  </label>
                  <input
                    type="text"
                    value={customBuildCommand}
                    onChange={(e) => setCustomBuildCommand(e.target.value)}
                    placeholder="e.g. npm run build (auto-detected if blank)"
                    className="w-full text-[11px] font-mono px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1">
                    Output Directory
                  </label>
                  <input
                    type="text"
                    value={customOutputDir}
                    onChange={(e) => setCustomOutputDir(e.target.value)}
                    placeholder="e.g. dist (auto-detected if blank)"
                    className="w-full text-[11px] font-mono px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStartDeploy}
            disabled={deploying}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {deploying ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Queuing Deployment...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Deploy to Production</span>
              </>
            )}
          </button>
        </div>

        {/* Deployments History List */}
        <div>
          <h4
            className={`font-bold text-[11px] uppercase tracking-wider mb-2.5 ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            Deployment History ({deployments.length})
          </h4>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-neutral-400">
              <RotateCw className="w-4 h-4 animate-spin mr-2" />
              <span>Loading deployment records...</span>
            </div>
          ) : deployments.length === 0 ? (
            <div
              className={`p-6 rounded-xl border text-center ${
                isDark ? "bg-neutral-900/30 border-neutral-800 text-neutral-400" : "bg-white border-neutral-200 text-neutral-500"
              }`}
            >
              <Rocket className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No deployments yet</p>
              <p className="text-[11px] opacity-70 mt-0.5">
                Click "Deploy to Production" above to create your first live release.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deployments.map((dep) => (
                <div
                  key={dep.deployId}
                  className={`p-3 rounded-xl border transition-all ${
                    isDark
                      ? "bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700"
                      : "bg-white border-neutral-200 hover:border-neutral-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(dep.status)}
                      <span className="font-mono text-[11px] font-bold text-inherit">
                        {dep.deployId}
                      </span>
                      {dep.isCurrent && dep.status === "ready" && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(dep.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400 flex items-center gap-2 mb-2">
                    <span>Framework: {dep.framework?.name || "Static"}</span>
                    <span>•</span>
                    <span>Branch: {dep.branch}</span>
                  </div>

                  {dep.error && (
                    <div className="mb-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono truncate">
                      {dep.error}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/50 text-[11px]">
                    {dep.status === "ready" && (
                      <a
                        href={deployService.getSiteUrl(projectId, dep.deployId)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center gap-1 font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Visit</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleViewLogs(dep.deployId)}
                      className={`px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                        isDark
                          ? "bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-300"
                          : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Logs</span>
                    </button>
                    <button
                      onClick={() => handleRedeploy(dep.deployId)}
                      className={`px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                        isDark
                          ? "bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-300"
                          : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200 text-neutral-700"
                      }`}
                      title="Redeploy this version"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Redeploy</span>
                    </button>
                    <button
                      onClick={() => handleDelete(dep.deployId)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                      title="Delete deployment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Build Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden ${
              isDark ? "bg-neutral-950 border-neutral-800 text-neutral-200" : "bg-white border-neutral-300 text-neutral-900"
            }`}
          >
            {/* Modal Header */}
            <div className="p-3 border-b flex items-center justify-between border-neutral-800 bg-neutral-900/40">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs font-mono">
                  Build Logs: {selectedDeployId}
                </span>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1 cursor-pointer"
                title="Close Logs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Terminal Log Output */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] bg-black text-neutral-300 space-y-1">
              {loadingLogs ? (
                <div className="text-neutral-500 py-4 text-center">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-neutral-500 py-4 text-center">No build output logged yet.</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      log.stream === "stderr"
                        ? "text-rose-400"
                        : log.stream === "system"
                        ? "text-cyan-400"
                        : "text-neutral-300"
                    }`}
                  >
                    <span className="text-neutral-600 select-none mr-2">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    {log.message}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-neutral-800 bg-neutral-900/40 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPanel;
