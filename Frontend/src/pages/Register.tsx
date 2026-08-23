import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAlert } from "../hooks/useAlert";
import { useTheme } from "../context/ThemeContext";
import API_URL from "../config/api";

interface FormData {
  name: string;
  email: string;
  password: string;
}

function Register() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      showSuccess("Account created successfully");
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        showError(error.message);
      } else {
        showError("An unknown error occurred during registration");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-200 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-150 ${
      isDark ? "bg-black text-white" : "bg-white text-black"
    }`}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[500px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 mb-6 sm:mb-8 tracking-tight group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-extrabold text-white text-xs shadow-md shadow-blue-500/20">
            CF
          </div>
          <span className={`text-2xl font-bold ${isDark ? "text-white" : "text-black"}`}>
            Cloud<span className="text-blue-500 font-extrabold">Forge</span>
          </span>
        </Link>

        <div className={`border rounded-2xl p-6 sm:p-8 shadow-xl ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200/80 shadow-neutral-200/50"
        }`}>
          <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-black"}`}>
            Create account
          </h2>

          <p className={`text-xs sm:text-sm mt-1.5 mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Get started with your free CloudForge developer account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                Full Name
              </label>

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className={`w-full px-3.5 py-2.5 sm:py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-xs sm:text-sm ${
                  isDark
                    ? "bg-black border-neutral-700 text-white placeholder:text-neutral-500 focus:bg-black"
                    : "bg-neutral-50 border-neutral-300 text-black placeholder:text-neutral-400 focus:bg-white"
                }`}
                placeholder="Alex Developer"
              />
            </div>

            <div>
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className={`w-full px-3.5 py-2.5 sm:py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-xs sm:text-sm ${
                  isDark
                    ? "bg-black border-neutral-700 text-white placeholder:text-neutral-500 focus:bg-black"
                    : "bg-neutral-50 border-neutral-300 text-black placeholder:text-neutral-400 focus:bg-white"
                }`}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                Password
              </label>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                className={`w-full px-3.5 py-2.5 sm:py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-xs sm:text-sm ${
                  isDark
                    ? "bg-black border-neutral-700 text-white placeholder:text-neutral-500 focus:bg-black"
                    : "bg-neutral-50 border-neutral-300 text-black placeholder:text-neutral-400 focus:bg-white"
                }`}
                placeholder="At least 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {loading ? "Creating account..." : "Create Free Account"}
            </button>
          </form>

          <p className={`text-center text-xs sm:text-sm mt-6 font-medium ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-500 hover:text-blue-400 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;