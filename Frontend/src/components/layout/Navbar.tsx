import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, LayoutDashboard, FolderCode, Sun, Moon } from "lucide-react";
import { useAlert } from "../../hooks/useAlert";
import { useTheme } from "../../context/ThemeContext";
import { BrandLogo } from "../ui/BrandLogo";
import API_URL from "../../config/api";

interface NavbarProps {
  user: {
    name: string;
    email: string;
  } | null;
}

function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useAlert();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      showSuccess("Successfully signed out");
      navigate("/login");
    } catch (error) {
      showError("Failed to sign out. Please try again.");
    }
  };

  const navLinks = [
    { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Projects", path: "/projects", icon: <FolderCode className="w-4 h-4" /> },
  ];

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-md font-sans transition-colors duration-150 ${
      isDark
        ? "bg-black/90 border-neutral-800 text-white"
        : "bg-white/95 border-neutral-200 text-black"
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 sm:gap-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight focus:outline-none cursor-pointer"
          >
            <BrandLogo size={32} variant="nebulacode" isDark={isDark} />
            <span>
              Nebula<span className="text-blue-500 font-extrabold">Code</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? isDark
                        ? "bg-blue-500/20 text-blue-400 font-bold"
                        : "bg-blue-50 text-blue-600 font-bold"
                      : isDark
                      ? "text-neutral-400 hover:text-white hover:bg-neutral-900"
                      : "text-neutral-600 hover:text-black hover:bg-neutral-100"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block text-right">
            <p className={`text-xs font-bold max-w-[150px] truncate ${isDark ? "text-white" : "text-black"}`}>
              {user?.name || "User"}
            </p>
            <p className="text-[10px] text-neutral-400 max-w-[150px] truncate">
              {user?.email || ""}
            </p>
          </div>

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold uppercase shrink-0 shadow-2xs ${
              isDark
                ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                : "bg-blue-50 border border-blue-100 text-blue-600"
            }`}
            title={user?.name || "User Account"}
          >
            {user?.name?.charAt(0) || "U"}
          </div>

          {/* Instant Dark / Light Toggle without reload */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
              isDark
                ? "bg-neutral-900 hover:bg-neutral-800 text-blue-400 border-neutral-800"
                : "bg-neutral-100 hover:bg-neutral-200 text-blue-600 border-neutral-200"
            }`}
            title={isDark ? "Switch to Pure Light Mode" : "Switch to Pure Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-blue-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-600" />
            )}
          </button>

          <button
            onClick={handleLogout}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs cursor-pointer ${
              isDark
                ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400"
                : "bg-white border-neutral-200 text-neutral-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600"
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className={`md:hidden border-t px-4 pt-3 pb-4 shadow-lg animate-in slide-in-from-top-2 ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl border mb-3 ${
            isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-100"
          }`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-bold text-sm truncate ${isDark ? "text-white" : "text-black"}`}>
                {user?.name || "User"}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {user?.email || "Signed in"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive
                      ? isDark
                        ? "bg-blue-500/20 text-blue-400 font-bold"
                        : "bg-blue-50 text-blue-700 font-bold"
                      : isDark
                      ? "text-neutral-300 hover:bg-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                isDark
                  ? "bg-neutral-900 border-neutral-800 text-neutral-200"
                  : "bg-neutral-50 border-neutral-200 text-neutral-700"
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-blue-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;