import { useEffect, useState } from "react";
import { useAlert } from "../../hooks/useAlert";
import { useTheme } from "../../context/ThemeContext";
import API_URL from "../../config/api";
import { type Project } from "../../types/project";

interface EditProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onUpdated: (project: Project) => void;
}

function EditProjectModal({
  project,
  onClose,
  onUpdated,
}: EditProjectModalProps) {
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
    }
  }, [project]);

  if (!project) {
    return null;
  }

  const handleUpdate = async () => {
    if (!name.trim()) {
      showError("Project name is required.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/projects/${project._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showError(data.message || "Failed to update project.");
        return;
      }

      onUpdated(data.project);
      showSuccess("Project updated successfully.");
      onClose();
    } catch (error) {
      showError("Failed to update project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className={`w-full max-w-lg rounded-2xl shadow-xl border p-5 sm:p-6 max-h-[90vh] overflow-y-auto font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>
              Edit Project
            </h3>
            <p className={`text-xs sm:text-sm mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Update your workspace project metadata.
            </p>
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
            <label className={`block text-xs sm:text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                isDark ? "bg-black border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs sm:text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isDark ? "bg-black border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
              }`}
            />
          </div>
        </div>

        <div className={`flex justify-end gap-2.5 mt-6 pt-4 border-t ${
          isDark ? "border-neutral-800" : "border-neutral-100"
        }`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              isDark ? "border-neutral-700 text-neutral-300 hover:bg-neutral-900" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleUpdate}
            disabled={loading || !name.trim()}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProjectModal;