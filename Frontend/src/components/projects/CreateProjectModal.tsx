import { useState } from "react";
import { useAlert } from "../../hooks/useAlert";
import { useTheme } from "../../context/ThemeContext";
import API_URL from "../../config/api";
import { type CreateProjectData, type Project } from "../../types/project";
import { Sparkles, FolderPlus } from "lucide-react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();

  const [form, setForm] = useState<CreateProjectData>({
    name: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showError("Please enter a project name.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Failed to create project.");
        return;
      }

      showSuccess(`Created "${data.project.name}" workspace`);
      onCreated(data.project);
      onClose();
      setForm({ name: "", description: "" });
    } catch (error) {
      showError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className={`w-full max-w-md rounded-2xl shadow-xl border p-6 max-h-[90vh] overflow-y-auto font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-black"}`}>
                Create New Project
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Create an empty project workspace.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className={`text-2xl disabled:opacity-50 cursor-pointer ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-black"}`}
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
              isDark ? "text-neutral-300" : "text-neutral-700"
            }`}>
              Project Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. My Workspace Project"
              disabled={loading}
              autoFocus
              className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                isDark ? "bg-black border-neutral-700 text-white placeholder-neutral-500" : "bg-white border-neutral-300 text-black placeholder-neutral-400"
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
              isDark ? "text-neutral-300" : "text-neutral-700"
            }`}>
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe your workspace project..."
              rows={3}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isDark ? "bg-black border-neutral-700 text-white placeholder-neutral-500" : "bg-white border-neutral-300 text-black placeholder-neutral-400"
              }`}
            />
          </div>
        </div>

        <div className={`flex justify-end gap-3 mt-6 pt-4 border-t ${
          isDark ? "border-neutral-800" : "border-neutral-100"
        }`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
              isDark ? "border-neutral-700 text-neutral-300 hover:bg-neutral-900" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleCreate}
            disabled={loading || !form.name.trim()}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Creating..." : "Create Project"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateProjectModal;