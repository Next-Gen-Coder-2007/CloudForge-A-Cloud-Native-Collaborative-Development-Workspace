/**
 * In-House Prettier-Grade Multi-Language Code Formatter / Beautifier
 * Zero External Dependencies
 */

export function formatCode(
  code: string,
  language: string,
  tabSize: number = 2
): string {
  if (!code || !code.trim()) return code;

  const lang = language.toLowerCase();
  const indentStr = " ".repeat(tabSize);

  switch (lang) {
    case "json":
    case "jsonc":
      return formatJson(code, tabSize);

    case "html":
    case "xml":
    case "svg":
      return formatHtml(code, indentStr);

    case "css":
    case "scss":
    case "less":
      return formatCss(code, indentStr);

    case "python":
      return formatPython(code, indentStr);

    case "javascript":
    case "typescript":
    case "tsx":
    case "jsx":
    case "c-like":
    case "sql":
    default:
      return formatJavaScript(code, indentStr);
  }
}

/**
 * 1. JSON Prettier Formatter
 */
function formatJson(code: string, tabSize: number): string {
  try {
    const parsed = JSON.parse(code);
    return JSON.stringify(parsed, null, tabSize) + "\n";
  } catch {
    // If strict JSON.parse fails (e.g. comments or unquoted keys), fall back to structural formatting
    return formatJavaScript(code, " ".repeat(tabSize));
  }
}

/**
 * 2. JavaScript / TypeScript / TSX Prettier-grade Formatter
 */
function formatJavaScript(code: string, indentStr: string): string {
  // Step 1: Pre-process tokens, protecting strings and comments
  const stringLiterals: string[] = [];
  const mask = "___STR_TOKEN_" + Math.random().toString(36).slice(2) + "___";

  let protectedCode = "";
  let inString: string | null = null;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const nextCh = code[i + 1] || "";

    // Line comment
    if (!inString && !inTemplate && !inBlockComment && ch === "/" && nextCh === "/") {
      inLineComment = true;
      let comment = "";
      while (i < code.length && code[i] !== "\n") {
        comment += code[i++];
      }
      const tokenKey = `${mask}${stringLiterals.length}___`;
      stringLiterals.push(comment);
      protectedCode += tokenKey;
      if (i < code.length && code[i] === "\n") protectedCode += "\n";
      inLineComment = false;
      continue;
    }

    // Block comment
    if (!inString && !inTemplate && !inLineComment && ch === "/" && nextCh === "*") {
      inBlockComment = true;
      let comment = "/*";
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        comment += code[i++];
      }
      comment += "*/";
      i++;
      const tokenKey = `${mask}${stringLiterals.length}___`;
      stringLiterals.push(comment);
      protectedCode += tokenKey;
      inBlockComment = false;
      continue;
    }

    // Strings
    if (!inTemplate && (ch === '"' || ch === "'")) {
      const isEscaped = i > 0 && code[i - 1] === "\\";
      if (!isEscaped) {
        if (!inString) {
          inString = ch;
          let str = ch;
          i++;
          while (i < code.length && (code[i] !== inString || code[i - 1] === "\\")) {
            str += code[i++];
          }
          if (i < code.length) str += code[i];
          const tokenKey = `${mask}${stringLiterals.length}___`;
          stringLiterals.push(str);
          protectedCode += tokenKey;
          inString = null;
          continue;
        }
      }
    }

    // Template Literals
    if (!inString && ch === "`") {
      const isEscaped = i > 0 && code[i - 1] === "\\";
      if (!isEscaped) {
        let tmpl = "`";
        i++;
        while (i < code.length && (code[i] !== "`" || code[i - 1] === "\\")) {
          tmpl += code[i++];
        }
        if (i < code.length) tmpl += code[i];
        const tokenKey = `${mask}${stringLiterals.length}___`;
        stringLiterals.push(tmpl);
        protectedCode += tokenKey;
        continue;
      }
    }

    protectedCode += ch;
  }

  // Step 2: Normalize spacing around brackets and operators
  let formatted = protectedCode
    // Space around binary operators
    .replace(/\s*([=+\-*\/%><!&|^~?:]+)\s*/g, (_, op) => {
      // Don't space JSX closing slash or single colon in cases/types without context
      if (op === "/" || op === ":") return ` ${op} `;
      if (["++", "--", "!", "...", "::"].includes(op)) return op;
      return ` ${op} `;
    })
    // Fix arrow functions
    .replace(/=\s*>/g, "=>")
    // Fix strict equality and multi-char ops
    .replace(/=\s*=\s*=/g, "===")
    .replace(/!\s*=\s*=/g, "!==")
    .replace(/=\s*=/g, "==")
    .replace(/!\s*=/g, "!=")
    .replace(/<\s*=/g, "<=")
    .replace(/>\s*=/g, ">=")
    .replace(/&\s*&/g, "&&")
    .replace(/\|\s*\|/g, "||")
    .replace(/\?\s*\?/g, "??")
    .replace(/\+\s*\+/g, "++")
    .replace(/-\s*-/g, "--")
    .replace(/\+\s*=/g, "+=")
    .replace(/-\s*=/g, "-=")
    .replace(/\*\s*=/g, "*=")
    .replace(/\/\s*=/g, "/=")
    // Space after commas and semicolons
    .replace(/,\s*/g, ", ")
    .replace(/;\s*/g, ";\n")
    // Space after control keywords
    .replace(/\b(if|for|while|switch|catch)\s*\(/g, "$1 (")
    .replace(/\b(function|class|interface|type|const|let|var|return|import|export|from|default|extends|implements)\s+/g, "$1 ")
    // Break lines for curly brackets
    .replace(/\s*\{\s*/g, " {\n")
    .replace(/\s*\}\s*/g, "\n}\n")
    // Clean up empty lines
    .replace(/\n\s*\n\s*\n+/g, "\n\n");

  // Step 3: Compute intelligent line indentation
  const rawLines = formatted.split("\n");
  const processedLines: string[] = [];
  let indentLevel = 0;

  for (let l = 0; l < rawLines.length; l++) {
    const trimmed = rawLines[l].trim();
    if (!trimmed) {
      if (processedLines.length > 0 && processedLines[processedLines.length - 1] !== "") {
        processedLines.push("");
      }
      continue;
    }

    // Decrement indent for closing brackets on current line
    const leadingClose = (trimmed.match(/^[}\]\)]/) || []).length;
    const lineIndent = Math.max(0, indentLevel - leadingClose);

    processedLines.push(indentStr.repeat(lineIndent) + trimmed);

    // Count open vs close brackets
    let net = 0;
    for (let c = 0; c < trimmed.length; c++) {
      const char = trimmed[c];
      if (char === "{" || char === "[" || char === "(") net++;
      if (char === "}" || char === "]" || char === ")") net--;
    }

    indentLevel = Math.max(0, indentLevel + net);
  }

  // Step 4: Restore protected strings & comments
  let result = processedLines.join("\n");
  stringLiterals.forEach((str, idx) => {
    const tokenKey = `${mask}${idx}___`;
    result = result.split(tokenKey).join(str);
  });

  return result.trim() + "\n";
}

/**
 * 3. HTML / XML Prettier-grade Formatter
 */
function formatHtml(code: string, indentStr: string): string {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tokens = code.replace(/>\s*</g, ">\n<").split("\n");
  const result: string[] = [];
  let indentLevel = 0;

  for (const raw of tokens) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const isClosing = trimmed.startsWith("</");
    const isOpening = trimmed.startsWith("<") && !isClosing && !trimmed.startsWith("<!") && !trimmed.startsWith("<?");
    const isSelfClosing = trimmed.endsWith("/>") || (isOpening && voidTags.has((trimmed.match(/<([a-zA-Z0-9\-]+)/) || [])[1]?.toLowerCase()));

    if (isClosing) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    result.push(indentStr.repeat(indentLevel) + trimmed);

    if (isOpening && !isSelfClosing) {
      indentLevel++;
    }
  }

  return result.join("\n").trim() + "\n";
}

/**
 * 4. CSS / SCSS Prettier-grade Formatter
 */
function formatCss(code: string, indentStr: string): string {
  let cleaned = code
    .replace(/\s*\{\s*/g, " {\n")
    .replace(/\s*;\s*/g, ";\n")
    .replace(/\s*\}\s*/g, "\n}\n")
    .replace(/:\s*/g, ": ");

  const lines = cleaned.split("\n");
  const result: string[] = [];
  let indentLevel = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }

    if (trimmed === "}") {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    result.push(indentStr.repeat(indentLevel) + trimmed);

    if (trimmed.endsWith("{")) {
      indentLevel++;
    }
  }

  return result.join("\n").trim() + "\n";
}

/**
 * 5. Python Prettier-grade Formatter
 */
function formatPython(code: string, indentStr: string): string {
  const lines = code.split("\n");
  const result: string[] = [];
  let indentLevel = 0;
  const blockStarters = ["def ", "class ", "if ", "elif ", "else:", "for ", "while ", "try:", "except", "finally:", "with "];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }

    // Dedent for elif/else/except/finally
    if (trimmed.startsWith("elif ") || trimmed.startsWith("else:") || trimmed.startsWith("except") || trimmed.startsWith("finally:")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Format operators with clean spacing
    let formattedLine = trimmed
      .replace(/\s*([=+\-*\/%<>!]+)\s*/g, " $1 ")
      .replace(/==/g, "==")
      .replace(/!=/g, "!=")
      .replace(/<=/g, "<=")
      .replace(/>=/g, ">=")
      .replace(/,\s*/g, ", ")
      .replace(/:\s*$/, ":");

    result.push(indentStr.repeat(indentLevel) + formattedLine);

    // Increment indent after colon
    if (trimmed.endsWith(":") || blockStarters.some((b) => trimmed.startsWith(b))) {
      if (trimmed.endsWith(":")) {
        indentLevel++;
      }
    }
  }

  return result.join("\n").trim() + "\n";
}
