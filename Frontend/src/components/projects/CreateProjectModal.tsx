import { useState } from "react";
import { useAlert } from "../../hooks/useAlert";
import { useTheme } from "../../context/ThemeContext";
import API_URL, { getAuthHeaders } from "../../config/api";
import { type CreateProjectData, type Project } from "../../types/project";
import {
  Sparkles,
  FolderPlus,
  X,
  Check,
  Code2,
  FileCode,
  Cpu,
  Layers,
  Wrench,
  Coffee,
  Globe,
  Folder,
  type LucideIcon,
} from "lucide-react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

interface RuntimeTemplate {
  id: string;
  name: string;
  icon: LucideIcon;
  badge: string;
  color: string;
  desc: string;
}

const RUNTIME_TEMPLATES: RuntimeTemplate[] = [
  {
    id: "node",
    name: "Node.js & TS",
    icon: Code2,
    badge: "Node 20",
    color: "#3178c6",
    desc: "JavaScript, TypeScript, Express, or full-stack APIs",
  },
  {
    id: "python",
    name: "Python",
    icon: FileCode,
    badge: "Python 3.11",
    color: "#3572A5",
    desc: "FastAPI, Flask, scripts, or data processing",
  },
  {
    id: "go",
    name: "Go (Golang)",
    icon: Cpu,
    badge: "Go 1.22",
    color: "#00ADD8",
    desc: "High-performance microservices and CLI tools",
  },
  {
    id: "rust",
    name: "Rust",
    icon: Layers,
    badge: "Rust 1.76",
    color: "#dea584",
    desc: "Memory-safe systems programming with Cargo",
  },
  {
    id: "cpp",
    name: "C / C++",
    icon: Wrench,
    badge: "GCC 12",
    color: "#f34b7d",
    desc: "Native C and C++ programs with Makefile",
  },
  {
    id: "java",
    name: "Java",
    icon: Coffee,
    badge: "Java 17",
    color: "#b07219",
    desc: "Enterprise Java apps with OpenJDK 17",
  },
  {
    id: "web",
    name: "Static Web",
    icon: Globe,
    badge: "HTML5/CSS",
    color: "#e34c26",
    desc: "HTML5, CSS3, and JavaScript frontend apps",
  },
  {
    id: "blank",
    name: "Blank",
    icon: Folder,
    badge: "Custom",
    color: "#6b7280",
    desc: "Empty workspace to build from scratch",
  },
];

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
    template: "node",
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
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || "",
          template: form.template || "node",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Failed to create project.");
        return;
      }

      showSuccess(`Created "${data.project.name}" workspace (${form.template?.toUpperCase() || "NODE"})`);
      onCreated(data.project);
      onClose();
      setForm({ name: "", description: "", template: "node" });
    } catch {
      showError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border p-6 max-h-[92vh] overflow-y-auto font-sans transition-colors duration-150 ${
          isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
        }`}
      >
        {/* Header */}
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
                Select a language runtime or start with a custom template.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className={`p-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer ${
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-neutral-900"
                : "text-neutral-500 hover:text-black hover:bg-neutral-100"
            }`}
          >
            <X className="w-5 h-5" strokeWidth={2.3} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Project Name */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                isDark ? "text-neutral-300" : "text-neutral-700"
              }`}
            >
              Project Name <span className="text-red-500">*</span>
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
                isDark
                  ? "bg-black border-neutral-700 text-white placeholder-neutral-500"
                  : "bg-white border-neutral-300 text-black placeholder-neutral-400"
              }`}
            />
          </div>

          {/* Runtime / Language Selector */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
                isDark ? "text-neutral-300" : "text-neutral-700"
              }`}
            >
              Choose Runtime & Language
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RUNTIME_TEMPLATES.map((tmpl) => {
                const isSelected = (form.template || "node") === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, template: tmpl.id }))}
                    disabled={loading}
                    className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? isDark
                          ? "bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/50 shadow-xs"
                          : "bg-blue-50/80 border-blue-500 ring-1 ring-blue-500/50 shadow-xs"
                        : isDark
                        ? "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                        : "bg-neutral-50/60 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <tmpl.icon className="w-4 h-4 shrink-0" style={{ color: tmpl.color }} />
                        <span className="text-xs font-bold truncate">{tmpl.name}</span>
                      </div>
                      <p
                        className={`text-[10px] line-clamp-2 leading-tight ${
                          isDark ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      >
                        {tmpl.desc}
                      </p>
                    </div>
                    <div className="mt-2">
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                        style={{
                          backgroundColor: `${tmpl.color}20`,
                          color: tmpl.color,
                          border: `1px solid ${tmpl.color}40`,
                        }}
                      >
                        {tmpl.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                isDark ? "text-neutral-300" : "text-neutral-700"
              }`}
            >
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe your workspace project..."
              rows={2}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isDark
                  ? "bg-black border-neutral-700 text-white placeholder-neutral-500"
                  : "bg-white border-neutral-300 text-black placeholder-neutral-400"
              }`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={`flex justify-end gap-3 mt-6 pt-4 border-t ${
            isDark ? "border-neutral-800" : "border-neutral-100"
          }`}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
              isDark
                ? "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
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