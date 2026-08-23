import React from "react";
import {
  FileJson,
  FileText,
  FileImage,
  Folder,
  FolderOpen,
  Code2,
  FileSpreadsheet,
} from "lucide-react";
import {
  SiReact,
  SiTypescript,
  SiJavascript,
  SiPython,
  SiHtml5,
  SiMarkdown,
  SiGit,
  SiNodedotjs,
} from "react-icons/si";

interface FileIconProps {
  name: string;
  type: "file" | "directory";
  isOpen?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  type,
  isOpen = false,
  className = "w-4 h-4",
}) => {
  if (type === "directory") {
    return isOpen ? (
      <FolderOpen className={`${className} text-blue-500 shrink-0`} />
    ) : (
      <Folder className={`${className} text-blue-500 shrink-0`} />
    );
  }

  const lower = name.toLowerCase();
  const ext = lower.split(".").pop() || "";

  if (lower === ".gitignore" || lower.includes("git")) {
    return <SiGit className={`${className} text-orange-500 shrink-0`} />;
  }

  if (lower === "package.json") {
    return <SiNodedotjs className={`${className} text-emerald-500 shrink-0`} />;
  }

  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
    return <SiReact className={`${className} text-cyan-400 shrink-0`} />;
  }

  if (ext === "ts") {
    return <SiTypescript className={`${className} text-blue-500 shrink-0`} />;
  }

  if (ext === "js" || ext === "mjs") {
    return <SiJavascript className={`${className} text-yellow-400 shrink-0`} />;
  }

  if (ext === "py") {
    return <SiPython className={`${className} text-blue-400 shrink-0`} />;
  }

  if (ext === "html" || ext === "htm") {
    return <SiHtml5 className={`${className} text-orange-500 shrink-0`} />;
  }

  if (ext === "css" || ext === "scss" || ext === "less") {
    return <Code2 className={`${className} text-sky-400 shrink-0`} />;
  }

  if (ext === "json") {
    return <FileJson className={`${className} text-sky-400 shrink-0`} />;
  }

  if (ext === "md" || ext === "markdown") {
    return <SiMarkdown className={`${className} text-slate-300 shrink-0`} />;
  }

  if (["png", "jpg", "jpeg", "svg", "gif", "ico"].includes(ext)) {
    return <FileImage className={`${className} text-purple-400 shrink-0`} />;
  }

  if (["csv", "tsv"].includes(ext)) {
    return <FileSpreadsheet className={`${className} text-emerald-400 shrink-0`} />;
  }

  if (["sh", "bash", "zsh"].includes(ext)) {
    return <Code2 className={`${className} text-green-400 shrink-0`} />;
  }

  return <FileText className={`${className} text-slate-400 shrink-0`} />;
};
