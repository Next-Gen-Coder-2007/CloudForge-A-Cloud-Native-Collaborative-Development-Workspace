import React from "react";
import {
  CloudLightning,
  Code2,
  Terminal,
  Boxes,
  Flame,
  Sparkles,
  Layers,
} from "lucide-react";

export type LogoVariant =
  | "nebulacode"
  | "code"
  | "terminal"
  | "boxes"
  | "flame"
  | "synthex"
  | "novaforge"
  | "kinetix";

interface BrandLogoProps {
  variant?: LogoVariant;
  size?: number | string;
  className?: string;
  showGlow?: boolean;
  isDark?: boolean;
  type?: "badge" | "plain"; // badge with rounded background or plain icon
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "nebulacode",
  size = 32,
  className = "",
  showGlow = true,
  isDark: isDarkProp,
  type = "badge",
}) => {
  const isDarkClass = typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true;
  const isDark = isDarkProp !== undefined ? isDarkProp : isDarkClass;

  const numSize = typeof size === "number" ? size : parseInt(size, 10) || 32;
  const iconSize = Math.max(14, Math.round(numSize * 0.62));
  const dimension = typeof size === "number" ? `${size}px` : size;

  // Render matching Lucide icon based on variant
  const renderLucideIcon = () => {
    switch (variant) {
      case "code":
      case "synthex":
        return <Code2 size={iconSize} strokeWidth={2.3} className="text-white" />;
      case "terminal":
        return <Terminal size={iconSize} strokeWidth={2.3} className="text-white" />;
      case "boxes":
      case "novaforge":
        return <Boxes size={iconSize} strokeWidth={2.3} className="text-white" />;
      case "flame":
        return <Flame size={iconSize} strokeWidth={2.3} className="text-white" />;
      case "kinetix":
        return <Layers size={iconSize} strokeWidth={2.3} className="text-white" />;
      case "nebulacode":
      default:
        return <CloudLightning size={iconSize} strokeWidth={2.3} className="text-white" />;
    }
  };

  if (type === "plain") {
    return (
      <div
        className={`inline-flex items-center justify-center shrink-0 text-blue-500 transition-transform duration-200 hover:scale-105 ${className}`}
        style={{ width: dimension, height: dimension }}
      >
        {variant === "nebulacode" ? (
          <CloudLightning size={numSize} strokeWidth={2.2} className="text-blue-500 drop-shadow-sm" />
        ) : variant === "code" || variant === "synthex" ? (
          <Code2 size={numSize} strokeWidth={2.2} className="text-blue-500 drop-shadow-sm" />
        ) : variant === "terminal" ? (
          <Terminal size={numSize} strokeWidth={2.2} className="text-blue-500 drop-shadow-sm" />
        ) : variant === "boxes" || variant === "novaforge" ? (
          <Boxes size={numSize} strokeWidth={2.2} className="text-blue-500 drop-shadow-sm" />
        ) : (
          <Sparkles size={numSize} strokeWidth={2.2} className="text-blue-500 drop-shadow-sm" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {showGlow && (
        <div
          className={`absolute inset-0 rounded-xl blur-sm transition-all duration-300 -z-10 ${
            isDark ? "bg-blue-600/40 opacity-70" : "bg-blue-500/30 opacity-60"
          }`}
        />
      )}
      <div
        className="w-full h-full rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/25 border border-blue-400/20"
      >
        {renderLucideIcon()}
      </div>
    </div>
  );
};

export default BrandLogo;
