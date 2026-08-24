import { useNavigate } from "react-router-dom";
import { type Project } from "../../types/project";
import { GitBranch } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ProjectCardProps {
  project: Project;
  onDelete: (projectId: string) => void;
  onEdit?: (project: Project) => void;
}

function ProjectCard({
  project,
  onDelete,
  onEdit,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`
    );

    if (confirmed) {
      onDelete(project._id);
    }
  };

  return (
    <div className={`border rounded-2xl p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between group font-sans ${
      isDark
        ? "bg-neutral-950 border-neutral-800 hover:border-blue-500/50 hover:shadow-lg"
        : "bg-white border-neutral-200/80 hover:border-blue-300 hover:shadow-md"
    }`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`text-base sm:text-lg font-bold truncate transition-colors ${
              isDark ? "text-white group-hover:text-blue-400" : "text-black group-hover:text-blue-600"
            }`}>
              {project.name}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold flex items-center gap-1 ${
                isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-100"
              }`}>
                <GitBranch className="w-3 h-3 text-blue-500" />
                <span>{project.currentBranch || "main"}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(project)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? "text-neutral-400 hover:text-blue-400 hover:bg-neutral-900" : "text-neutral-500 hover:text-blue-600 hover:bg-blue-50"
                }`}
                title="Edit Project"
              >
                Edit
              </button>
            )}

            <button
              onClick={handleDelete}
              className={`p-1 rounded-lg transition-colors text-lg leading-none cursor-pointer ${
                isDark ? "text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10" : "text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
              }`}
              title="Delete Project"
            >
              ×
            </button>
          </div>
        </div>

        <p className={`text-xs sm:text-sm mt-3 min-h-[36px] line-clamp-2 leading-relaxed ${
          isDark ? "text-neutral-400" : "text-neutral-500"
        }`}>
          {project.description || "No description provided."}
        </p>
      </div>

      <div className={`flex items-center justify-between mt-5 pt-3.5 border-t text-xs ${
        isDark ? "border-neutral-800" : "border-neutral-100"
      }`}>
        <p className={`text-[11px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          {new Date(project.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>

        <button
          onClick={() => navigate(`/projects/${project._id}`)}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <span>Open Workspace</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

export default ProjectCard;