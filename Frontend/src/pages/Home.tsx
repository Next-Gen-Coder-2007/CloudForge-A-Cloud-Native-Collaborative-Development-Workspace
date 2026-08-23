import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Code2, GitBranch, Layers, Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

function Home() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 ${
      isDark ? "bg-black text-white" : "bg-white text-black"
    }`}>
      <header className={`border-b backdrop-blur-md sticky top-0 z-50 transition-colors duration-150 ${
        isDark ? "border-neutral-800 bg-black/90" : "border-neutral-200 bg-white/90"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 font-extrabold text-white flex items-center justify-center text-xs shadow-md shadow-blue-500/20">
              CF
            </div>
            <span className="font-bold text-lg tracking-tight">
              Cloud<span className="text-blue-500 font-extrabold">Forge</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                isDark
                  ? "bg-neutral-900 hover:bg-neutral-800 text-blue-400 border-neutral-800"
                  : "bg-neutral-100 hover:bg-neutral-200 text-blue-600 border-neutral-200"
              }`}
              title={isDark ? "Switch to Pure Light Mode" : "Switch to Pure Dark Mode"}
            >
              {isDark ? <Sun className="w-4 h-4 text-blue-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>

            <Link
              to="/login"
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                isDark ? "text-neutral-300 hover:text-white hover:bg-neutral-900" : "text-neutral-700 hover:text-black hover:bg-neutral-100"
              }`}
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 sm:mb-8 animate-in fade-in border ${
            isDark ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-700"
          }`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proprietary Web IDE & Native Version Control</span>
          </div>

          <h1 className={`text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-4 sm:mb-6 ${
            isDark ? "text-white" : "text-black"
          }`}>
            Code, branch, and sync <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-sky-400 to-blue-600">
              in your browser.
            </span>
          </h1>

          <p className={`text-sm sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10 px-2 ${
            isDark ? "text-neutral-400" : "text-neutral-600"
          }`}>
            CloudForge is a fast, proprietary browser IDE featuring a custom zero-dependency syntax highlighter, pure Pitch Black & Pure White themes, and our own built-in Version Control System with branch management, file diffs, and 1-click time-travel rollback.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto sm:max-w-none">
            <Link
              to="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
            >
              <span>Get Started for Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login"
              className={`w-full sm:w-auto px-7 py-3.5 rounded-xl font-semibold border transition-all text-sm sm:text-base ${
                isDark
                  ? "bg-neutral-900 border-neutral-800 text-neutral-200 hover:bg-neutral-800"
                  : "bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200"
              }`}
            >
              Sign In to Workspace
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-16 sm:mt-24 text-left">
            <div className={`p-5 rounded-2xl border ${
              isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
              }`}>
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className={`font-bold text-sm mb-1 ${isDark ? "text-white" : "text-black"}`}>In-House Code Editor</h3>
              <p className={`text-xs leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Zero 3rd party dependencies. Built from scratch with dual-layer synchronized syntax highlighting and auto-formatting.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
              }`}>
                <GitBranch className="w-4 h-4" />
              </div>
              <h3 className={`font-bold text-sm mb-1 ${isDark ? "text-white" : "text-black"}`}>CloudForge Native VCS</h3>
              <p className={`text-xs leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Our own proprietary version control system. Snapshot commits, create and merge branches without external Git services.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
              }`}>
                <Layers className="w-4 h-4" />
              </div>
              <h3 className={`font-bold text-sm mb-1 ${isDark ? "text-white" : "text-black"}`}>Pure Black & Pure White</h3>
              <p className={`text-xs leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Instant theme switching without page reloads. Deep pitch black OLED dark mode and crisp pure white light mode.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;