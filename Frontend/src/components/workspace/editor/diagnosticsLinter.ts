export interface Diagnostic {
  id: string;
  line: number; // 1-indexed
  col: number; // 1-indexed
  endCol?: number;
  severity: "error" | "warning" | "info";
  message: string;
  source: string;
}

/**
 * High-speed in-house AST & Syntax Diagnostics Engine
 * Supports JS, TS, TSX, JSON, HTML, CSS, Python
 */
export function lintCode(code: string, language: string): Diagnostic[] {
  if (!code || !code.trim()) return [];

  switch (language.toLowerCase()) {
    case "json":
      return lintJson(code);
    case "javascript":
    case "typescript":
    case "tsx":
    case "jsx":
      return lintJavaScript(code, language);
    case "html":
      return lintHtml(code);
    case "css":
    case "scss":
      return lintCss(code);
    case "python":
      return lintPython(code);
    default:
      return lintGeneric(code);
  }
}

/**
 * JSON Syntax & Formatting Linter
 */
function lintJson(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    JSON.parse(code);
  } catch (err: any) {
    const message: string = err.message || "Invalid JSON syntax";
    let line = 1;
    let col = 1;

    // Extract position from error message (e.g. "at position 124" or "line 4 column 5")
    const lineColMatch = message.match(/line (\d+) column (\d+)/i);
    const posMatch = message.match(/position (\d+)/i);

    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      col = parseInt(lineColMatch[2], 10);
    } else if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const textBefore = code.slice(0, pos);
      const lines = textBefore.split("\n");
      line = lines.length;
      col = lines[lines.length - 1].length + 1;
    } else {
      // Find approximate first error line
      const lines = code.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.endsWith(",") && (i === lines.length - 1 || lines[i + 1].trim().startsWith("}") || lines[i + 1].trim().startsWith("]"))) {
          line = i + 1;
          col = lines[i].lastIndexOf(",") + 1;
          diagnostics.push({
            id: `json-trailing-comma-${i}`,
            line,
            col,
            endCol: col + 1,
            severity: "error",
            message: "Trailing comma is not permitted in JSON",
            source: "JSON Linter",
          });
          return diagnostics;
        }
      }
    }

    diagnostics.push({
      id: `json-syntax-err`,
      line,
      col,
      endCol: col + 10,
      severity: "error",
      message: message.replace(/^JSON\.parse:\s*/i, ""),
      source: "JSON Parser",
    });
  }

  return diagnostics;
}

/**
 * JS/TS/TSX Syntax Diagnostics
 */
function lintJavaScript(code: string, langName: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split("\n");

  interface BracketEntry {
    char: string;
    line: number;
    col: number;
  }

  const stack: BracketEntry[] = [];
  const matchingPairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  let inBlockComment = false;
  let inTemplateString = false;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const lineNum = l + 1;
    let inString: string | null = null;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      const nextChar = line[c + 1];

      // Handle block comments
      if (!inString && !inTemplateString) {
        if (!inBlockComment && char === "/" && nextChar === "*") {
          inBlockComment = true;
          c++;
          continue;
        }
        if (inBlockComment && char === "*" && nextChar === "/") {
          inBlockComment = false;
          c++;
          continue;
        }
      }

      if (inBlockComment) continue;

      // Handle line comments
      if (!inString && !inTemplateString && char === "/" && nextChar === "/") {
        break; // skip rest of line
      }

      // Handle string quotes
      if (!inTemplateString && (char === '"' || char === "'")) {
        const isEscaped = c > 0 && line[c - 1] === "\\";
        if (!isEscaped) {
          if (!inString) {
            inString = char;
          } else if (inString === char) {
            inString = null;
          }
        }
        continue;
      }

      // Handle template strings
      if (!inString && char === "`") {
        const isEscaped = c > 0 && line[c - 1] === "\\";
        if (!isEscaped) {
          inTemplateString = !inTemplateString;
        }
        continue;
      }

      if (inString || inTemplateString) continue;

      // Open brackets
      if (char === "(" || char === "[" || char === "{") {
        stack.push({ char, line: lineNum, col: c + 1 });
      }

      // Close brackets
      if (char === ")" || char === "]" || char === "}") {
        const expected = matchingPairs[char];
        if (stack.length === 0) {
          diagnostics.push({
            id: `extra-bracket-${lineNum}-${c}`,
            line: lineNum,
            col: c + 1,
            endCol: c + 2,
            severity: "error",
            message: `Unexpected closing bracket '${char}' without opening bracket`,
            source: `${langName.toUpperCase()} Syntax`,
          });
        } else {
          const top = stack.pop()!;
          if (top.char !== expected) {
            diagnostics.push({
              id: `mismatched-bracket-${lineNum}-${c}`,
              line: lineNum,
              col: c + 1,
              endCol: c + 2,
              severity: "error",
              message: `Mismatched bracket: expected closing for '${top.char}' (line ${top.line}), found '${char}'`,
              source: `${langName.toUpperCase()} Syntax`,
            });
          }
        }
      }
    }

    // Check for unclosed string on same line
    if (inString) {
      diagnostics.push({
        id: `unclosed-str-${lineNum}`,
        line: lineNum,
        col: line.lastIndexOf(inString) + 1,
        endCol: line.length + 1,
        severity: "error",
        message: `Unterminated string literal: missing closing ${inString}`,
        source: `${langName.toUpperCase()} Syntax`,
      });
    }
  }

  // Check for unclosed brackets left on stack
  while (stack.length > 0) {
    const unclosed = stack.pop()!;
    const closingMap: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
    diagnostics.push({
      id: `unclosed-bracket-${unclosed.line}-${unclosed.col}`,
      line: unclosed.line,
      col: unclosed.col,
      endCol: unclosed.col + 1,
      severity: "error",
      message: `Unclosed delimiter '${unclosed.char}': missing matching '${closingMap[unclosed.char] || ""}'`,
      source: `${langName.toUpperCase()} Syntax`,
    });
  }

  // Check for unclosed template literal
  if (inTemplateString) {
    diagnostics.push({
      id: `unclosed-template-literal`,
      line: lines.length,
      col: 1,
      endCol: 5,
      severity: "error",
      message: "Unterminated template literal: missing closing `",
      source: `${langName.toUpperCase()} Syntax`,
    });
  }

  // Common pattern checks (e.g. const without identifier or let/const at end of line)
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed === "const" || trimmed === "let" || trimmed === "var") {
      diagnostics.push({
        id: `empty-declaration-${idx + 1}`,
        line: idx + 1,
        col: line.indexOf(trimmed) + 1,
        endCol: line.indexOf(trimmed) + trimmed.length + 1,
        severity: "warning",
        message: `'${trimmed}' declaration must be followed by an identifier`,
        source: `${langName.toUpperCase()} Linter`,
      });
    }
  });

  return diagnostics;
}

/**
 * HTML Tag Linter
 */
function lintHtml(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split("\n");
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tagStack: { tag: string; line: number; col: number }[] = [];

  const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?(\/?)>/g;

  lines.forEach((line, lineIdx) => {
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
      const fullMatch = match[0];
      const tagName = match[1].toLowerCase();
      const isSelfClosing = match[2] === "/" || voidTags.has(tagName) || fullMatch.endsWith("/>");
      const isClosing = fullMatch.startsWith("</");
      const col = match.index + 1;

      if (isClosing) {
        if (tagStack.length === 0) {
          diagnostics.push({
            id: `extra-closing-tag-${lineIdx + 1}-${col}`,
            line: lineIdx + 1,
            col,
            endCol: col + fullMatch.length,
            severity: "error",
            message: `Unexpected closing tag </${tagName}> with no matching opening tag`,
            source: "HTML Linter",
          });
        } else {
          const last = tagStack.pop()!;
          if (last.tag !== tagName) {
            diagnostics.push({
              id: `mismatched-html-tag-${lineIdx + 1}-${col}`,
              line: lineIdx + 1,
              col,
              endCol: col + fullMatch.length,
              severity: "error",
              message: `Mismatched tag: expected </${last.tag}> (opened line ${last.line}), found </${tagName}>`,
              source: "HTML Linter",
            });
          }
        }
      } else if (!isSelfClosing) {
        tagStack.push({ tag: tagName, line: lineIdx + 1, col });
      }
    }
  });

  tagStack.forEach((unclosed) => {
    diagnostics.push({
      id: `unclosed-html-tag-${unclosed.line}-${unclosed.col}`,
      line: unclosed.line,
      col: unclosed.col,
      endCol: unclosed.col + unclosed.tag.length + 2,
      severity: "warning",
      message: `Unclosed HTML tag <${unclosed.tag}>: missing closing </${unclosed.tag}>`,
      source: "HTML Linter",
    });
  });

  return diagnostics;
}

/**
 * CSS Linter
 */
function lintCss(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split("\n");
  let openBraces = 0;
  let lastOpenLine = 1;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === "{") {
        openBraces++;
        lastOpenLine = lineNum;
      } else if (line[c] === "}") {
        if (openBraces === 0) {
          diagnostics.push({
            id: `extra-css-brace-${lineNum}-${c}`,
            line: lineNum,
            col: c + 1,
            endCol: c + 2,
            severity: "error",
            message: "Unexpected closing brace '}' without opening '{'",
            source: "CSS Linter",
          });
        } else {
          openBraces--;
        }
      }
    }
  });

  if (openBraces > 0) {
    diagnostics.push({
      id: `unclosed-css-rule-${lastOpenLine}`,
      line: lastOpenLine,
      col: 1,
      endCol: 5,
      severity: "error",
      message: "Unclosed CSS block: missing closing '}'",
      source: "CSS Linter",
    });
  }

  return diagnostics;
}

/**
 * Python Linter
 */
function lintPython(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split("\n");
  const blockKeywords = ["def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally", "with", "match", "case"];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) return;

    for (const kw of blockKeywords) {
      if (trimmed === kw || trimmed.startsWith(`${kw} `) || trimmed.startsWith(`${kw}(`)) {
        if (!trimmed.endsWith(":") && !trimmed.endsWith("\\")) {
          diagnostics.push({
            id: `py-missing-colon-${lineNum}`,
            line: lineNum,
            col: line.length,
            endCol: line.length + 1,
            severity: "error",
            message: `SyntaxError: expected ':' at end of '${kw}' statement`,
            source: "Python Linter",
          });
        }
        break;
      }
    }
  });

  return diagnostics;
}

/**
 * Generic Fallback Linter
 */
function lintGeneric(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split("\n");
  let openCodeFence = false;
  let fenceLine = 1;

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      if (!openCodeFence) {
        openCodeFence = true;
        fenceLine = idx + 1;
      } else {
        openCodeFence = false;
      }
    }
  });

  if (openCodeFence) {
    diagnostics.push({
      id: `unclosed-code-fence`,
      line: fenceLine,
      col: 1,
      endCol: 4,
      severity: "warning",
      message: "Unclosed markdown code block: missing closing ```",
      source: "Markdown Linter",
    });
  }

  return diagnostics;
}
