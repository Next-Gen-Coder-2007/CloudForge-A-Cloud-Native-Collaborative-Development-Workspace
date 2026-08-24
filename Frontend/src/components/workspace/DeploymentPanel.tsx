import React from "react";
import { Rocket } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface DeploymentPanelProps {
  projectName?: string;
}

export const DeploymentPanel: React.FC<DeploymentPanelProps> = () => {
  const { isDark } = useTheme();

  return (
    <div
      className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 text-neutral-200" : "bg-neutral-50 text-neutral-800"
      }`}
    >
      {/* Header */}
      <div
        className={`px-2.5 py-2 border-b shrink-0 flex items-center justify-between ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Rocket className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span
            className={`font-bold text-[11px] uppercase tracking-wider truncate ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            Deployment
          </span>
        </div>
      </div>

      {/* Centered Minimalist Animation & Coming Soon */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Animated Rocket with Ambient Glow & Orbit */}
        <div className="relative mb-4 flex items-center justify-center">
          {/* Subtle Ambient Pulse */}
          <div className="absolute w-24 h-24 bg-blue-500/15 rounded-full blur-xl animate-pulse pointer-events-none" />

          {/* Orbit Ring */}
          <div className="absolute w-20 h-20 rounded-full border border-blue-500/20 border-dashed animate-spin [animation-duration:12s] pointer-events-none" />

          {/* Floating Icon Box */}
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-lg transition-transform z-10 ${
              isDark
                ? "bg-black/90 border-neutral-800 text-blue-400 shadow-blue-500/10"
                : "bg-white border-neutral-200 text-blue-600 shadow-blue-100"
            }`}
          >
            <Rocket className="w-7 h-7 animate-bounce [animation-duration:2s]" />
          </div>
        </div>

        {/* Coming Soon Text */}
        <h3
          className={`font-bold text-sm tracking-tight ${
            isDark ? "text-white" : "text-black"
          }`}
        >
          Coming Soon
        </h3>

        <p
          className={`text-[11px] mt-1.5 leading-relaxed max-w-[200px] ${
            isDark ? "text-neutral-400" : "text-neutral-500"
          }`}
        >
          Cloud deployment and hosting features are currently in development.
        </p>
      </div>
    </div>
  );
};

export default DeploymentPanel;
