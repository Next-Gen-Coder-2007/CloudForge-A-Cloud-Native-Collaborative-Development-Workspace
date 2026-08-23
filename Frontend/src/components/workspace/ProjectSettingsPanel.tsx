import React, { useState } from "react";
import {
  Save,
  RotateCcw,
  Trash2,
  GitBranch,
  Cloud,
} from "lucide-react";
import API_URL from "../../config/api";
import { useAlert } from "../../hooks/useAlert";
import { type Project } from "../../types/project";
import { type WorkspaceFile, type GitCommit } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface ProjectSettingsPanelProps {
  project: Project;
  filesCount: number;
  commitsCount: number;
  onUpdateProject: (project: Project) => void;
  onResetTemplate: (
    project: Project,
    files: WorkspaceFile[],
    commits: GitCommit[]
  ) => void;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
  project,
  filesCount,
  commitsCount,
  onUpdateProject,
  onResetTemplate,
}) => {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useAlert();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [template, setTemplate] = useState(project.template || "blank");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      const res = await fetch(`${API_URL}/api/projects/${project._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          template,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update project");
      }

      onUpdateProject(data.project);
      showSuccess("Project settings saved successfully");
    } catch (err: any) {
      showError(err.message || "Failed to update project settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    if (
      !window.confirm(
        `Are you sure you want to reset workspace to "${template}" template? This will replace existing workspace files with template starter files.`
      )
    ) {
      return;
    }

    try {
      setIsResetting(true);
      const res = await fetch(
        `${API_URL}/api/projects/${project._id}/reset-template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ template }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reset template");
      }

      onResetTemplate(data.project, data.files, data.commits || []);
      showSuccess(`Workspace reset to starter template "${template}"`);
    } catch (err: any) {
      showError(err.message || "Failed to reset workspace template");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`${API_URL}/api/projects/${project._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete project");
      }

      showSuccess("Project deleted successfully");
      window.location.href = "/projects";
    } catch (err: any) {
      showError(err.message || "Failed to delete project");
      setIsDeleting(false);
    }
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-y-auto text-xs font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-white" : "bg-neutral-50/70 text-black"
    }`}>
      <div className={`p-3 border-b shrink-0 flex items-center justify-between ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <span className={`font-bold text-xs uppercase tracking-wider ${isDark ? "text-white" : "text-black"}`}>
          Project Settings
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2.5 rounded-xl border text-center shadow-2xs ${
            isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <p className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Total Files
            </p>
            <p className={`text-base font-bold mt-0.5 ${isDark ? "text-white" : "text-black"}`}>{filesCount}</p>
          </div>
          <div className={`p-2.5 rounded-xl border text-center shadow-2xs ${
            isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <p className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Total Commits
            </p>
            <p className="text-base font-bold text-blue-500 mt-0.5">{commitsCount}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className={`space-y-3 p-3.5 rounded-xl border shadow-2xs ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? "text-neutral-200" : "text-neutral-700"}`}>
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`w-full px-3 py-1.5 border rounded-lg outline-none focus:border-blue-500 ${
                isDark ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
              }`}
            />
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? "text-neutral-200" : "text-neutral-700"}`}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`w-full px-3 py-1.5 border rounded-lg outline-none focus:border-blue-500 resize-none ${
                isDark ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
              }`}
            />
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? "text-neutral-200" : "text-neutral-700"}`}>
              Template Type
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className={`w-full px-2.5 py-1.5 border rounded-lg outline-none focus:border-blue-500 ${
                isDark ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
              }`}
            >
              <option value="blank">Blank Project</option>
              <option value="react">React Application (Vite + TSX)</option>
              <option value="nodejs">Node.js Express Backend</option>
              <option value="python">Python 3 Application</option>
              <option value="html-css">HTML5 & CSS3 Webpage</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Project Settings"}</span>
          </button>
        </form>

        <div className={`p-3.5 rounded-xl border space-y-2.5 shadow-2xs ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>CloudForge VCS Status</span>
            <Cloud className="w-4 h-4 text-blue-500" />
          </div>
          <p className={`text-[11px] leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            All code changes, branches, snapshots, and commits are managed natively by our built-in CloudForge Version Control System.
          </p>
          <div className={`flex items-center justify-between text-[11px] p-2 rounded-lg border font-mono ${
            isDark ? "bg-neutral-900 border-neutral-800 text-neutral-300" : "bg-neutral-50 border-neutral-100 text-neutral-700"
          }`}>
            <span>Active Branch:</span>
            <span className="font-bold text-blue-500 flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {project.currentBranch || "main"}
            </span>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border space-y-2.5 shadow-2xs ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>Template Starter Re-seed</span>
            <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <p className={`text-[11px] leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Reset this workspace to default template starter files for <strong>{template}</strong>.
          </p>
          <button
            type="button"
            onClick={handleResetTemplate}
            disabled={isResetting}
            className={`w-full py-1.5 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
              isDark
                ? "bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700"
                : "bg-neutral-100 hover:bg-neutral-200 text-black border-neutral-200"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
            <span>{isResetting ? "Re-seeding..." : "Re-seed Starter Template"}</span>
          </button>
        </div>

        <div className={`p-3 rounded-xl border space-y-2 text-[11px] font-mono shadow-2xs ${
          isDark ? "bg-black border-neutral-800 text-neutral-400" : "bg-white border-neutral-200 text-neutral-500"
        }`}>
          <div className="flex items-center justify-between">
            <span>Project ID:</span>
            <span className={`truncate max-w-[120px] font-bold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>{project._id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Created:</span>
            <span className={isDark ? "text-neutral-200" : "text-neutral-800"}>
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
