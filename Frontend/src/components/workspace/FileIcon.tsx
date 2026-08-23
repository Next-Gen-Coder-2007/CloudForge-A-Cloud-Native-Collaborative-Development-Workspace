import React from "react";
import {
  FileJson,
  FileText,
  FileImage,
  Folder,
  FolderOpen,
  Code2,
  FileSpreadsheet,
  FileArchive,
  Music,
  Film,
  Layers,
  Sigma,
  FileCode,
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
  SiCplusplus,
  SiRust,
  SiGo,
  SiGnubash,
  SiYaml,
} from "react-icons/si";
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint } from "react-icons/fa6";

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

  // Git / Config
  if (lower === ".gitignore" || lower.includes("git")) {
    return <SiGit className={`${className} text-orange-500 shrink-0`} />;
  }
  if (lower === "package.json") {
    return <SiNodedotjs className={`${className} text-emerald-500 shrink-0`} />;
  }

  // Documents
  if (ext === "pdf") {
    return <FaFilePdf className={`${className} text-rose-500 shrink-0`} />;
  }
  if (["docx", "doc"].includes(ext)) {
    return <FaFileWord className={`${className} text-blue-600 shrink-0`} />;
  }
  if (["pptx", "ppt", "ppsx"].includes(ext)) {
    return <FaFilePowerpoint className={`${className} text-amber-500 shrink-0`} />;
  }
  if (["xlsx", "xls"].includes(ext)) {
    return <FaFileExcel className={`${className} text-emerald-600 shrink-0`} />;
  }
  if (["csv", "tsv"].includes(ext)) {
    return <FileSpreadsheet className={`${className} text-emerald-400 shrink-0`} />;
  }

  // TeX & Scientific Math
  if (["tex", "latex", "bib", "sty", "cls"].includes(ext)) {
    return <Sigma className={`${className} text-emerald-400 shrink-0`} />;
  }

  // Mermaid Diagrams
  if (["mermaid", "mmd"].includes(ext)) {
    return <Layers className={`${className} text-cyan-400 shrink-0`} />;
  }

  // Markdown & Readme
  if (ext === "md" || ext === "markdown" || lower.startsWith("readme")) {
    return <SiMarkdown className={`${className} text-blue-400 shrink-0`} />;
  }

  // React & Web Frameworks
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
    return <SiReact className={`${className} text-cyan-400 shrink-0`} />;
  }
  if (ext === "ts") {
    return <SiTypescript className={`${className} text-blue-500 shrink-0`} />;
  }
  if (ext === "js" || ext === "mjs" || ext === "cjs") {
    return <SiJavascript className={`${className} text-yellow-400 shrink-0`} />;
  }
  if (ext === "py") {
    return <SiPython className={`${className} text-blue-400 shrink-0`} />;
  }
  if (ext === "html" || ext === "htm") {
    return <SiHtml5 className={`${className} text-orange-500 shrink-0`} />;
  }
  if (["css", "scss", "sass", "less"].includes(ext)) {
    return <Code2 className={`${className} text-sky-400 shrink-0`} />;
  }
  if (ext === "json") {
    return <FileJson className={`${className} text-sky-400 shrink-0`} />;
  }
  if (["yml", "yaml"].includes(ext)) {
    return <SiYaml className={`${className} text-rose-400 shrink-0`} />;
  }

  // Images
  if (["png", "jpg", "jpeg", "svg", "gif", "webp", "ico", "bmp", "avif"].includes(ext)) {
    return <FileImage className={`${className} text-purple-400 shrink-0`} />;
  }

  // Audio & Video Media
  if (["mp3", "wav", "ogg", "aac", "flac"].includes(ext)) {
    return <Music className={`${className} text-emerald-400 shrink-0`} />;
  }
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
    return <Film className={`${className} text-rose-400 shrink-0`} />;
  }

  // Archives
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
    return <FileArchive className={`${className} text-amber-400 shrink-0`} />;
  }

  // Systems & Languages
  if (["cpp", "c", "h", "hpp", "cc"].includes(ext)) {
    return <SiCplusplus className={`${className} text-blue-500 shrink-0`} />;
  }
  if (ext === "rs") {
    return <SiRust className={`${className} text-orange-600 shrink-0`} />;
  }
  if (ext === "go") {
    return <SiGo className={`${className} text-cyan-500 shrink-0`} />;
  }
  if (["sh", "bash", "zsh"].includes(ext)) {
    return <SiGnubash className={`${className} text-green-400 shrink-0`} />;
  }
  if (["sql"].includes(ext)) {
    return <FileCode className={`${className} text-blue-400 shrink-0`} />;
  }

  return <FileText className={`${className} text-slate-400 shrink-0`} />;
};
export default FileIcon;
