/**
 * Minimal & Safe ANSI Color Code Parser for Jupyter Terminal / Error Tracebacks
 */

const ANSI_COLOR_MAP: Record<string, string> = {
  // Standard colors
  "30": "text-neutral-500", // Black
  "31": "text-rose-400 font-semibold", // Red
  "32": "text-emerald-400 font-semibold", // Green
  "33": "text-amber-400 font-semibold", // Yellow
  "34": "text-blue-400 font-semibold", // Blue
  "35": "text-purple-400 font-semibold", // Magenta
  "36": "text-cyan-400 font-semibold", // Cyan
  "37": "text-neutral-200", // White
  "90": "text-neutral-400", // Bright Black / Gray
  "91": "text-rose-300 font-bold", // Bright Red
  "92": "text-emerald-300 font-bold", // Bright Green
  "93": "text-amber-300 font-bold", // Bright Yellow
  "94": "text-blue-300 font-bold", // Bright Blue
  "95": "text-purple-300 font-bold", // Bright Magenta
  "96": "text-cyan-300 font-bold", // Bright Cyan
  "97": "text-white font-bold", // Bright White
  // Styles
  "1": "font-bold",
  "2": "opacity-75",
  "3": "italic",
  "4": "underline",
};

/**
 * Converts text containing ANSI escape sequences into sanitized HTML with Tailwind classes
 */
export function ansiToHtml(rawText: string): string {
  if (!rawText) return "";

  // Split by ANSI escape sequences \u001b[...m
  const parts = rawText.split(/\u001b\[([0-9;]+)m/);
  let html = "";
  let activeClasses: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // Escape sequence code(s)
      const codes = parts[i].split(";");
      for (const code of codes) {
        if (code === "0" || code === "") {
          activeClasses = [];
        } else if (ANSI_COLOR_MAP[code]) {
          activeClasses.push(ANSI_COLOR_MAP[code]);
        }
      }
    } else {
      // Normal text
      const text = parts[i];
      if (text) {
        // Escape basic HTML chars
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        if (activeClasses.length > 0) {
          html += `<span class="${activeClasses.join(" ")}">${escaped}</span>`;
        } else {
          html += escaped;
        }
      }
    }
  }

  return html;
}
