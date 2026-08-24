import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config/api";
import { useAlert } from "../hooks/useAlert";
import { useTheme } from "../context/ThemeContext";
import Navbar from "../components/layout/Navbar";
import LoadingSpinner from "../components/ui/LoadingSpinner";

interface User {
  name: string;
  email: string;
}

interface Project {
  _id: string;
  name: string;
  language?: string;
  description?: string;
  updatedAt: string;
}

function Dashboard() {
  const navigate = useNavigate();
  const { showError } = useAlert();
  const { isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const userResponse = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
        if (!userResponse.ok) {
          showError("Please sign in to access the dashboard.");
          navigate("/login");
          return;
        }
        const userData = await userResponse.json();
        setUser(userData.user);

        const projectResponse = await fetch(`${API_URL}/api/projects`, { credentials: "include" });
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProjects(projectData.projects || []);
        }
      } catch (error) {
        showError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [navigate, showError]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-150 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}>
        <LoadingSpinner text="Loading workspace..." fullScreen />
      </div>
    );
  }

  const recentProjects = projects.slice(0, 3);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-150 ${
      isDark ? "bg-black text-white" : "bg-white text-black"
    }`}>
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-1">
                Workspace Overview
              </p>
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${
                isDark ? "text-white" : "text-black"
              }`}>
                Welcome back, {user?.name?.split(" ")[0] || "Developer"}
              </h1>
              <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Manage your development workspaces and native version control snapshots.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/projects")}
                className="px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                + New Project
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className={`border rounded-2xl p-4 sm:p-6 shadow-2xs ${
            isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Total Projects</p>
            <p className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${isDark ? "text-white" : "text-black"}`}>{projects.length}</p>
          </div>
          <div className={`border rounded-2xl p-4 sm:p-6 shadow-2xs ${
            isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Active Workspace</p>
            <p className={`text-base sm:text-lg font-bold mt-1.5 flex items-center gap-2 ${isDark ? "text-white" : "text-black"}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              CloudForge Native VCS
            </p>
          </div>
          <div className={`border rounded-2xl p-4 sm:p-6 shadow-2xs ${
            isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Account Email</p>
            <p className={`text-base sm:text-lg font-bold mt-1.5 truncate ${isDark ? "text-white" : "text-black"}`}>{user?.email}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className={`lg:col-span-2 border rounded-2xl p-5 sm:p-6 shadow-2xs ${
            isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>Recent Projects</h2>
                <p className={`text-xs sm:text-sm mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Quickly access and edit your workspace projects.</p>
              </div>
              <button
                onClick={() => navigate("/projects")}
                className={`self-start sm:self-auto px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? "bg-neutral-900 text-neutral-300 hover:bg-neutral-800" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                View All
              </button>
            </div>

            {recentProjects.length === 0 ? (
              <div className={`border border-dashed rounded-xl p-6 sm:p-8 text-center ${
                isDark ? "border-neutral-800" : "border-neutral-300"
              }`}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl flex items-center justify-center text-lg sm:text-xl font-bold ${
                  isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"
                }`}>
                  +
                </div>
                <h3 className={`font-bold text-sm sm:text-base mt-3 ${isDark ? "text-white" : "text-black"}`}>No projects yet</h3>
                <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Create your first project to start coding.</p>
                <button
                  onClick={() => navigate("/projects")}
                  className="mt-3.5 text-xs sm:text-sm font-semibold text-blue-500 hover:text-blue-400 cursor-pointer"
                >
                  Create a project →
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentProjects.map((project) => (
                  <button
                    key={project._id}
                    onClick={() => navigate(`/projects/${project._id}`)}
                    className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all text-left group cursor-pointer ${
                      isDark
                        ? "border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900"
                        : "border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isDark
                          ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                          : "bg-blue-50 border border-blue-100 text-blue-600"
                      }`}>
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-xs sm:text-sm truncate transition-colors ${
                          isDark ? "text-white group-hover:text-blue-400" : "text-black group-hover:text-blue-600"
                        }`}>
                          {project.name}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                          {project.description || "Cloud Workspace"}
                        </p>
                      </div>
                    </div>
                    <span className="text-neutral-400 text-sm group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
                      →
                    </span>
                  </button>
                ))}
                {projects.length > 3 && (
                  <button
                    onClick={() => navigate("/projects")}
                    className="w-full pt-2 text-xs sm:text-sm font-semibold text-blue-500 hover:text-blue-400 text-center cursor-pointer"
                  >
                    View all {projects.length} projects →
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={`border rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between ${
            isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
          }`}>
            <div>
              <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>Quick Actions</h2>
              <p className={`text-xs sm:text-sm mt-0.5 mb-4 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Shortcuts to common workflows.</p>
              <div className="space-y-2.5">
                <button
                  onClick={() => navigate("/projects")}
                  className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                    isDark
                      ? "border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900"
                      : "border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                  }`}>
                    +
                  </div>
                  <div>
                    <p className={`font-bold text-xs sm:text-sm ${isDark ? "text-white" : "text-black"}`}>Manage Projects</p>
                    <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Create, edit, or launch development workspaces</p>
                  </div>
                </button>

                <div className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border text-left ${
                  isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-100 bg-neutral-50"
                }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                  }`}>
                    VCS
                  </div>
                  <div>
                    <p className={`font-bold text-xs sm:text-sm ${isDark ? "text-white" : "text-black"}`}>Native Version Control</p>
                    <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Built-in branch snapshots & time travel</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`border rounded-2xl p-5 sm:p-6 shadow-2xs ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>Account Details</h2>
              <p className={`text-xs sm:text-sm mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Your CloudForge profile credentials.</p>
            </div>
            <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold uppercase ${
              isDark ? "bg-blue-500/15 border border-blue-500/30 text-blue-400" : "bg-blue-50 border border-blue-100 text-blue-600"
            }`}>
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className={`p-3.5 rounded-xl border ${
              isDark ? "bg-black border-neutral-800" : "bg-neutral-50 border-neutral-200"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>User Name</p>
              <p className={`text-xs sm:text-sm font-bold mt-1 truncate ${isDark ? "text-white" : "text-black"}`}>{user?.name}</p>
            </div>
            <div className={`p-3.5 rounded-xl border ${
              isDark ? "bg-black border-neutral-800" : "bg-neutral-50 border-neutral-200"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Email Address</p>
              <p className={`text-xs sm:text-sm font-bold mt-1 truncate ${isDark ? "text-white" : "text-black"}`}>{user?.email}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;