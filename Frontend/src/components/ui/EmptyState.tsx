import { FolderPlus, Plus } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface EmptyStateProps {
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

function EmptyState({
  title,
  description,
  buttonText,
  onButtonClick,
}: EmptyStateProps) {
  const { isDark } = useTheme();

  return (
    <div className={`border rounded-2xl p-8 sm:p-12 text-center transition-colors duration-150 ${
      isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
    }`}>
      <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
        isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "bg-blue-50 text-blue-600 border border-blue-100"
      }`}>
        <FolderPlus className="w-6 h-6" strokeWidth={2.2} />
      </div>

      <h3 className={`text-lg font-bold mt-5 ${isDark ? "text-white" : "text-black"}`}>
        {title}
      </h3>

      <p className={`text-xs sm:text-sm mt-1.5 max-w-sm mx-auto ${
        isDark ? "text-neutral-400" : "text-neutral-500"
      }`}>
        {description}
      </p>

      {buttonText && onButtonClick && (
        <button
          onClick={onButtonClick}
          className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>{buttonText}</span>
        </button>
      )}
    </div>
  );
}

export default EmptyState;