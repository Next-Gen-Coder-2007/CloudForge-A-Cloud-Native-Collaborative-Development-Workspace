import type { TokenType } from "./syntaxTokenizer";

export interface EditorTheme {
  id: string;
  name: string;
  isDark: boolean;
  accentColor: string;
  bg: string;
  gutterBg: string;
  activeLineBg: string;
  selectionBg: string;
  cursorColor: string;
  lineNumberColor: string;
  activeLineNumberColor: string;
  borderColor: string;
  toolbarBg: string;
  statusBg: string;
  textColor: string;
  matchHighlightBg: string;
  bracketMatchBg: string;
  tokenColors: Record<TokenType, string>;
}

export const THEME_DARK: EditorTheme = {
  id: "dark",
  name: "Dark Mode",
  isDark: true,
  accentColor: "#3b82f6", // Electric CloudForge Blue
  bg: "#000000", // Pure Pitch Black
  gutterBg: "#050505", // Deep Black Gutter
  activeLineBg: "#111111", // Subtle Black highlight
  selectionBg: "rgba(59, 130, 246, 0.4)", // Blue selection
  cursorColor: "#60a5fa", // Bright blue cursor
  lineNumberColor: "#525252", // Neutral-600
  activeLineNumberColor: "#60a5fa", // Blue active number
  borderColor: "#1f1f1f", // Neutral-850 Border
  toolbarBg: "#080808", // Pitch Black Toolbar
  statusBg: "#000000",
  textColor: "#ffffff", // Crisp Pure White Text
  matchHighlightBg: "rgba(59, 130, 246, 0.35)",
  bracketMatchBg: "rgba(59, 130, 246, 0.4)",
  tokenColors: {
    keyword: "#60a5fa", // Blue-400
    storage: "#60a5fa",
    function: "#38bdf8", // Sky-400
    string: "#4ade80", // Emerald-400
    number: "#38bdf8", // Sky-400
    comment: "#737373", // Neutral-500
    boolean: "#f43f5e", // Rose-500
    type: "#38bdf8", // Sky-400
    operator: "#93c5fd", // Light Blue
    punctuation: "#a3a3a3", // Neutral-400
    tag: "#60a5fa",
    attribute: "#38bdf8", // Sky-400
    property: "#67e8f9", // Cyan-300
    variable: "#ffffff", // Pure White
    regexp: "#4ade80",
    decorator: "#60a5fa",
    "markdown-heading": "#38bdf8",
    "markdown-bold": "#60a5fa",
    "markdown-italic": "#60a5fa",
    "markdown-code": "#4ade80",
    "markdown-link": "#38bdf8",
    text: "#ffffff",
  },
};

export const THEME_LIGHT: EditorTheme = {
  id: "light",
  name: "Light Mode",
  isDark: false,
  accentColor: "#2563eb", // Deep Blue-600
  bg: "#ffffff", // Pure White
  gutterBg: "#fafafa", // Clean White Gutter
  activeLineBg: "#f5f5f5", // Light highlight
  selectionBg: "rgba(191, 219, 254, 0.7)", // Blue selection
  cursorColor: "#000000", // Pure Black cursor
  lineNumberColor: "#a3a3a3", // Neutral-400
  activeLineNumberColor: "#2563eb", // Blue active number
  borderColor: "#e5e5e5", // Neutral-200 Border
  toolbarBg: "#fafafa", // Clean White Toolbar
  statusBg: "#ffffff",
  textColor: "#000000", // Crisp Pure Black Text
  matchHighlightBg: "rgba(59, 130, 246, 0.2)",
  bracketMatchBg: "rgba(37, 99, 235, 0.25)",
  tokenColors: {
    keyword: "#2563eb", // Blue-600
    storage: "#2563eb",
    function: "#0284c7", // Sky-600
    string: "#16a34a", // Green-600
    number: "#0284c7", // Sky-600
    comment: "#737373", // Neutral-500
    boolean: "#e11d48", // Rose-600
    type: "#0284c7", // Sky-600
    operator: "#1d4ed8", // Dark Blue
    punctuation: "#525252", // Neutral-600
    tag: "#2563eb",
    attribute: "#0284c7", // Sky-600
    property: "#0284c7",
    variable: "#000000", // Pure Black
    regexp: "#16a34a",
    decorator: "#2563eb",
    "markdown-heading": "#0284c7",
    "markdown-bold": "#2563eb",
    "markdown-italic": "#2563eb",
    "markdown-code": "#16a34a",
    "markdown-link": "#0284c7",
    text: "#000000",
  },
};

export const EDITOR_THEMES: Record<string, EditorTheme> = {
  dark: THEME_DARK,
  light: THEME_LIGHT,
};
