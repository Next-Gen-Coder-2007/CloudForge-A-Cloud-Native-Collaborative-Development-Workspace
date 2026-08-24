import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config/api";
import { useAlert } from "../hooks/useAlert";
import { useTheme } from "../context/ThemeContext";
import Navbar from "../components/layout/Navbar";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";
import ProjectGrid from "../components/projects/ProjectGrid";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import EditProjectModal from "../components/projects/EditProjectModal";
import DeleteProjectModal from "../components/projects/DeleteProjectModal";
import { type Project } from "../types/project";

interface User {
  name: string;
  email: string;
}

function Projects() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const userResponse = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
        if (!userResponse.ok) {
          showError("Please sign in to access your projects.");
          navigate("/login");
          return;
        }
        const userData = await userResponse.json();
        setUser(userData.user);

        const projectResponse = await fetch(`${API_URL}/api/projects`, { credentials: "include" });
        if (!projectResponse.ok) throw new Error("Failed to fetch projects");
        const projectData = await projectResponse.json();
        setProjects(projectData.projects || []);
      } catch (error) {
        showError("Failed to load projects.");
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [navigate, showError]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      [project.name, project.description].some((value) => value?.toLowerCase().includes(query))
    );
  }, [projects, search]);

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects((prev) => prev.map((project) => (project._id === updatedProject._id ? updatedProject : project)));
    setEditingProject(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    try {
      const response = await fetch(`${API_URL}/api/projects/${deletingProject._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Failed to delete project.");
        return;
      }
      setProjects((prev) => prev.filter((project) => project._id !== deletingProject._id));
      showSuccess(`Deleted project "${deletingProject.name}"`);
      setDeletingProject(null);
    } catch (error) {
      showError("Failed to delete project.");
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-150 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}>
        <LoadingSpinner text="Loading projects..." fullScreen />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-150 ${
      isDark ? "bg-black text-white" : "bg-white text-black"
    }`}>
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold mb-3 cursor-pointer transition-colors ${
              isDark ? "text-neutral-400 hover:text-blue-400" : "text-neutral-500 hover:text-blue-600"
            }`}
          >
            ← Back to Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-1">
                Cloud Workspaces
              </p>
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${
                isDark ? "text-white" : "text-black"
              }`}>
                Projects
              </h1>
              <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Create, manage, and code in workspaces with native version control.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 text-center cursor-pointer"
              >
                + New Project
              </button>
            </div>
          </div>
        </section>

        <section className={`border rounded-2xl p-3 sm:p-4 mb-6 shadow-2xs ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name or description..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                  isDark
                    ? "bg-black border-neutral-700 text-white placeholder-neutral-500 focus:bg-black"
                    : "bg-neutral-50 border-neutral-200 text-black placeholder-neutral-400 focus:bg-white"
                }`}
              />
            </div>
            <div className={`flex items-center justify-center px-3.5 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold shrink-0 ${
              isDark ? "bg-black border-neutral-800 text-neutral-300" : "bg-neutral-50 border-neutral-200 text-neutral-600"
            }`}>
              {filteredProjects.length} {filteredProjects.length === 1 ? "Project" : "Projects"}
            </div>
          </div>
        </section>

        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first CloudForge project with native version control."
            buttonText="+ Create Project"
            onButtonClick={() => setShowCreate(true)}
          />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            title="No matching projects"
            description="No projects match your current search query. Try another keyword."
          />
        ) : (
          <ProjectGrid
            projects={filteredProjects}
            onDelete={(project) => setDeletingProject(project)}
            onEdit={(project) => setEditingProject(project)}
          />
        )}
      </main>

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={handleProjectCreated} />
      <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onUpdated={handleProjectUpdated} />
      {deletingProject && (
        <DeleteProjectModal
          isOpen={Boolean(deletingProject)}
          onClose={() => setDeletingProject(null)}
          projectName={deletingProject.name}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default Projects;