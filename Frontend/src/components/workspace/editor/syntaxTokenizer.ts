export type TokenType =
  | "keyword"
  | "storage"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "boolean"
  | "type"
  | "operator"
  | "punctuation"
  | "tag"
  | "attribute"
  | "property"
  | "variable"
  | "regexp"
  | "decorator"
  | "markdown-heading"
  | "markdown-bold"
  | "markdown-italic"
  | "markdown-code"
  | "markdown-link"
  | "text";

export interface CodeToken {
  type: TokenType;
  text: string;
}

export interface HighlightedLine {
  tokens: CodeToken[];
}

const JS_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "finally", "for", "from", "function", "get", "if", "implements", "import",
  "in", "instanceof", "interface", "let", "new", "of", "package", "private",
  "protected", "public", "return", "set", "static", "super", "switch",
  "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield"
]);

const JS_BUILTINS = new Set([
  "true", "false", "null", "undefined", "NaN", "Infinity", "console", "window",
  "document", "global", "process", "Math", "JSON", "Promise", "Array", "Object",
  "String", "Number", "Boolean", "RegExp", "Map", "Set", "Symbol", "Date",
  "Error", "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval"
]);

const TS_TYPES = new Set([
  "string", "number", "boolean", "any", "void", "never", "unknown", "object",
  "symbol", "bigint", "Record", "Partial", "Pick", "Omit", "Required",
  "Readonly", "Promise", "Array", "ReactNode", "FC", "ReactElement", "JSX"
]);

const PY_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case"
]);

const PY_BUILTINS = new Set([
  "True", "False", "None", "self", "cls", "print", "len", "range", "str",
  "int", "float", "bool", "list", "dict", "set", "tuple", "open", "type",
  "isinstance", "enumerate", "zip", "map", "filter", "sum", "min", "max",
  "abs", "all", "any", "super", "__init__", "__name__", "__main__"
]);

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "CREATE", "TABLE", "DATABASE", "DROP", "ALTER", "ADD", "COLUMN",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "JOIN", "INNER", "LEFT", "RIGHT",
  "FULL", "OUTER", "ON", "GROUP", "BY", "ORDER", "ASC", "DESC", "HAVING",
  "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "AS", "AND", "OR", "NOT",
  "IN", "BETWEEN", "LIKE", "IS", "NULL", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "CASE", "WHEN", "THEN", "ELSE", "END", "INDEX", "VIEW", "GRANT", "REVOKE"
]);

const CSS_PROPERTIES = new Set([
  "display", "position", "top", "right", "bottom", "left", "z-index",
  "flex", "flex-direction", "justify-content", "align-items", "align-content",
  "grid", "grid-template-columns", "grid-template-rows", "gap", "width",
  "min-width", "max-width", "height", "min-height", "max-height", "margin",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "color",
  "background", "background-color", "background-image", "border", "border-radius",
  "font-family", "font-size", "font-weight", "line-height", "text-align",
  "text-decoration", "overflow", "overflow-x", "overflow-y", "opacity",
  "box-shadow", "transition", "transform", "animation", "cursor", "outline"
]);

export function normalizeLanguage(langOrExt: string, filename?: string): string {
  const ext = (filename ? filename.split(".").pop() : "")?.toLowerCase() || "";
  const lang = (langOrExt || ext || "").toLowerCase().trim();

  if (["tsx", "jsx"].includes(lang) || ["tsx", "jsx"].includes(ext)) return "tsx";
  if (["typescript", "ts"].includes(lang) || ext === "ts") return "typescript";
  if (["javascript", "js", "mjs", "cjs"].includes(lang) || ["js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["html", "htm", "svg", "vue"].includes(lang) || ["html", "htm", "svg", "vue"].includes(ext)) return "html";
  if (["css", "scss", "sass", "less"].includes(lang) || ["css", "scss", "sass", "less"].includes(ext)) return "css";
  if (["json", "jsonc"].includes(lang) || ["json", "jsonc"].includes(ext)) return "json";
  if (["python", "py"].includes(lang) || ext === "py") return "python";
  if (["sql", "mysql", "pgsql"].includes(lang) || ext === "sql") return "sql";
  if (["markdown", "md", "mdx"].includes(lang) || ["md", "mdx"].includes(ext)) return "markdown";
  if (["yaml", "yml"].includes(lang) || ["yaml", "yml"].includes(ext)) return "yaml";
  if (["shell", "bash", "sh", "zsh", "powershell", "ps1"].includes(lang) || ["sh", "bash", "zsh", "ps1"].includes(ext)) return "shell";
  if (["cpp", "c", "h", "hpp", "java", "cs", "go", "rs", "rust"].includes(lang) || ["cpp", "c", "h", "hpp", "java", "cs", "go", "rs"].includes(ext)) return "c-like";

  return "javascript"; // default fallback
}

export function tokenizeCode(code: string, language: string): HighlightedLine[] {
  const normLang = normalizeLanguage(language);
  const rawLines = code.split("\n");
  const result: HighlightedLine[] = [];

  let inBlockComment = false;
  let inHtmlComment = false;
  let inMultilineString = false;
  let multilineQuote = "";

  for (let l = 0; l < rawLines.length; l++) {
    const line = rawLines[l];
    const tokens: CodeToken[] = [];
    let i = 0;
    const len = line.length;

    if (len === 0) {
      result.push({ tokens: [] });
      continue;
    }

    // Continue multiline block comment
    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx === -1) {
        tokens.push({ type: "comment", text: line });
        result.push({ tokens });
        continue;
      } else {
        tokens.push({ type: "comment", text: line.substring(0, endIdx + 2) });
        i = endIdx + 2;
        inBlockComment = false;
      }
    }

    // Continue multiline HTML comment
    if (inHtmlComment) {
      const endIdx = line.indexOf("-->");
      if (endIdx === -1) {
        tokens.push({ type: "comment", text: line });
        result.push({ tokens });
        continue;
      } else {
        tokens.push({ type: "comment", text: line.substring(0, endIdx + 3) });
        i = endIdx + 3;
        inHtmlComment = false;
      }
    }

    // Continue multiline string (e.g. backticks in JS or triple-quotes in Python)
    if (inMultilineString) {
      const endIdx = line.indexOf(multilineQuote, i);
      if (endIdx === -1) {
        tokens.push({ type: "string", text: line.substring(i) });
        result.push({ tokens });
        continue;
      } else {
        tokens.push({ type: "string", text: line.substring(i, endIdx + multilineQuote.length) });
        i = endIdx + multilineQuote.length;
        inMultilineString = false;
        multilineQuote = "";
      }
    }

    while (i < len) {
      // 1. Whitespace
      if (/\s/.test(line[i])) {
        let ws = "";
        while (i < len && /\s/.test(line[i])) {
          ws += line[i++];
        }
        tokens.push({ type: "text", text: ws });
        continue;
      }

      // 2. Comments
      // Block comment start /*
      if (["javascript", "typescript", "tsx", "css", "c-like", "json", "sql"].includes(normLang) && line.startsWith("/*", i)) {
        const endIdx = line.indexOf("*/", i + 2);
        if (endIdx === -1) {
          tokens.push({ type: "comment", text: line.substring(i) });
          inBlockComment = true;
          i = len;
        } else {
          tokens.push({ type: "comment", text: line.substring(i, endIdx + 2) });
          i = endIdx + 2;
        }
        continue;
      }

      // HTML comment <!--
      if (["html", "markdown", "tsx"].includes(normLang) && line.startsWith("<!--", i)) {
        const endIdx = line.indexOf("-->", i + 4);
        if (endIdx === -1) {
          tokens.push({ type: "comment", text: line.substring(i) });
          inHtmlComment = true;
          i = len;
        } else {
          tokens.push({ type: "comment", text: line.substring(i, endIdx + 3) });
          i = endIdx + 3;
        }
        continue;
      }

      // Line comment //
      if (["javascript", "typescript", "tsx", "c-like", "json"].includes(normLang) && line.startsWith("//", i)) {
        tokens.push({ type: "comment", text: line.substring(i) });
        i = len;
        continue;
      }

      // Line comment #
      if (["python", "shell", "yaml"].includes(normLang) && line[i] === "#") {
        tokens.push({ type: "comment", text: line.substring(i) });
        i = len;
        continue;
      }

      // Line comment -- (SQL)
      if (normLang === "sql" && line.startsWith("--", i)) {
        tokens.push({ type: "comment", text: line.substring(i) });
        i = len;
        continue;
      }

      // 3. Strings
      // Python Triple quotes """ or '''
      if (normLang === "python" && (line.startsWith('"""', i) || line.startsWith("'''", i))) {
        const q = line.substring(i, i + 3);
        const endIdx = line.indexOf(q, i + 3);
        if (endIdx === -1) {
          tokens.push({ type: "string", text: line.substring(i) });
          inMultilineString = true;
          multilineQuote = q;
          i = len;
        } else {
          tokens.push({ type: "string", text: line.substring(i, endIdx + 3) });
          i = endIdx + 3;
        }
        continue;
      }

      // Template string ` in JS/TS
      if (["javascript", "typescript", "tsx"].includes(normLang) && line[i] === "`") {
        let str = "`";
        let j = i + 1;
        let closed = false;
        while (j < len) {
          if (line[j] === "\\" && j + 1 < len) {
            str += line[j] + line[j + 1];
            j += 2;
            continue;
          }
          if (line[j] === "`") {
            str += "`";
            j++;
            closed = true;
            break;
          }
          str += line[j++];
        }
        tokens.push({ type: "string", text: str });
        if (!closed) {
          inMultilineString = true;
          multilineQuote = "`";
          i = len;
        } else {
          i = j;
        }
        continue;
      }

      // Single/Double quote strings
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let str = quote;
        let j = i + 1;
        while (j < len) {
          if (line[j] === "\\" && j + 1 < len) {
            str += line[j] + line[j + 1];
            j += 2;
            continue;
          }
          if (line[j] === quote) {
            str += quote;
            j++;
            break;
          }
          str += line[j++];
        }
        tokens.push({ type: "string", text: str });
        i = j;
        continue;
      }

      // 4. Numbers
      if (/[0-9]/.test(line[i]) || (line[i] === "." && i + 1 < len && /[0-9]/.test(line[i + 1]))) {
        let num = "";
        // Hex / Binary / Octal
        if (line[i] === "0" && i + 1 < len && /[xXbBoO]/.test(line[i + 1])) {
          num += line[i++] + line[i++];
          while (i < len && /[0-9a-fA-F_]/.test(line[i])) {
            num += line[i++];
          }
        } else {
          while (i < len && /[0-9._eE+-]/.test(line[i])) {
            // handle exponent signs
            if ((line[i] === "+" || line[i] === "-") && !/[eE]/.test(line[i - 1])) {
              break;
            }
            num += line[i++];
          }
          // handle 'px', 'rem', '%', 'ms', 's', 'em', 'vh', 'vw' in CSS
          if (normLang === "css" && i < len && /[a-zA-Z%]/.test(line[i])) {
            let unit = "";
            while (i < len && /[a-zA-Z%]/.test(line[i])) {
              unit += line[i++];
            }
            tokens.push({ type: "number", text: num + unit });
            continue;
          }
        }
        tokens.push({ type: "number", text: num });
        continue;
      }

      // 5. HTML / JSX Tags & Attributes
      if (["html", "tsx", "javascript", "typescript"].includes(normLang) && (line[i] === "<" || line.startsWith("</", i))) {
        const tagMatch = line.substring(i).match(/^<\/?([a-zA-Z0-9_$-]+)/);
        if (tagMatch) {
          const fullMatch = tagMatch[0];
          tokens.push({ type: "tag", text: fullMatch });
          i += fullMatch.length;
          continue;
        }
      }

      // 6. Markdown Features
      if (normLang === "markdown") {
        if (i === 0 && line.startsWith("#")) {
          const headingMatch = line.match(/^#{1,6}\s+.*/);
          if (headingMatch) {
            tokens.push({ type: "markdown-heading", text: line });
            i = len;
            continue;
          }
        }
        if (line.startsWith("`", i)) {
          const codeMatch = line.substring(i).match(/^`[^`]+`/);
          if (codeMatch) {
            tokens.push({ type: "markdown-code", text: codeMatch[0] });
            i += codeMatch[0].length;
            continue;
          }
        }
        if (line.startsWith("**", i) || line.startsWith("__", i)) {
          const boldMatch = line.substring(i).match(/^(\*\*|__)[^*_]+(\*\*|__)/);
          if (boldMatch) {
            tokens.push({ type: "markdown-bold", text: boldMatch[0] });
            i += boldMatch[0].length;
            continue;
          }
        }
        if (line.startsWith("[", i)) {
          const linkMatch = line.substring(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            tokens.push({ type: "markdown-link", text: linkMatch[0] });
            i += linkMatch[0].length;
            continue;
          }
        }
      }

      // 7. Decorators (@Component, @decorator)
      if (line[i] === "@" && i + 1 < len && /[a-zA-Z_]/.test(line[i + 1])) {
        let dec = "@";
        i++;
        while (i < len && /[a-zA-Z0-9_]/.test(line[i])) {
          dec += line[i++];
        }
        tokens.push({ type: "decorator", text: dec });
        continue;
      }

      // 8. Words (Keywords, Identifiers, Types, Functions, Properties)
      if (/[a-zA-Z_$]/.test(line[i])) {
        let word = "";
        const wordStart = i;
        while (i < len && /[a-zA-Z0-9_$-]/.test(line[i])) {
          word += line[i++];
        }

        // Peek next non-whitespace char to detect function calls
        let nextChar = "";
        let k = i;
        while (k < len && /\s/.test(line[k])) k++;
        if (k < len) nextChar = line[k];

        // Match based on language
        if (["javascript", "typescript", "tsx"].includes(normLang)) {
          if (JS_KEYWORDS.has(word)) {
            tokens.push({ type: "keyword", text: word });
          } else if (JS_BUILTINS.has(word)) {
            tokens.push({ type: "boolean", text: word });
          } else if (TS_TYPES.has(word) || (word[0] === word[0].toUpperCase() && /[a-z]/.test(word) && !nextChar.includes("("))) {
            tokens.push({ type: "type", text: word });
          } else if (nextChar === "(") {
            tokens.push({ type: "function", text: word });
          } else if (wordStart > 0 && line[wordStart - 1] === ".") {
            tokens.push({ type: "property", text: word });
          } else if (nextChar === "=" && !line.substring(k).startsWith("==") && !line.substring(k).startsWith("=>")) {
            tokens.push({ type: "attribute", text: word });
          } else {
            tokens.push({ type: "variable", text: word });
          }
          continue;
        }

        if (normLang === "python") {
          if (PY_KEYWORDS.has(word)) {
            tokens.push({ type: "keyword", text: word });
          } else if (PY_BUILTINS.has(word)) {
            tokens.push({ type: "boolean", text: word });
          } else if (word[0] === word[0].toUpperCase() && /[a-z]/.test(word)) {
            tokens.push({ type: "type", text: word });
          } else if (nextChar === "(") {
            tokens.push({ type: "function", text: word });
          } else {
            tokens.push({ type: "variable", text: word });
          }
          continue;
        }

        if (normLang === "sql") {
          const upperWord = word.toUpperCase();
          if (SQL_KEYWORDS.has(upperWord)) {
            tokens.push({ type: "keyword", text: word });
          } else if (nextChar === "(") {
            tokens.push({ type: "function", text: word });
          } else {
            tokens.push({ type: "variable", text: word });
          }
          continue;
        }

        if (normLang === "css") {
          if (CSS_PROPERTIES.has(word.toLowerCase())) {
            tokens.push({ type: "property", text: word });
          } else if (nextChar === "(") {
            tokens.push({ type: "function", text: word });
          } else {
            tokens.push({ type: "variable", text: word });
          }
          continue;
        }

        if (normLang === "json") {
          if (["true", "false", "null"].includes(word)) {
            tokens.push({ type: "boolean", text: word });
          } else {
            tokens.push({ type: "variable", text: word });
          }
          continue;
        }

        // Generic fallback for word
        if (nextChar === "(") {
          tokens.push({ type: "function", text: word });
        } else {
          tokens.push({ type: "variable", text: word });
        }
        continue;
      }

      // 9. Operators & Symbols
      const twoChars = line.substring(i, i + 2);
      const threeChars = line.substring(i, i + 3);

      if (["===", "!==", "...", ">>>", "<<=", ">>="].includes(threeChars)) {
        tokens.push({ type: "operator", text: threeChars });
        i += 3;
        continue;
      }

      if (["==", "!=", "<=", ">=", "=>", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "??", "?."].includes(twoChars)) {
        tokens.push({ type: "operator", text: twoChars });
        i += 2;
        continue;
      }

      if ("+-*/%=<>!&|^~?:".includes(line[i])) {
        tokens.push({ type: "operator", text: line[i++] });
        continue;
      }

      // 10. Brackets & Punctuation
      if ("{}()[].,;".includes(line[i])) {
        tokens.push({ type: "punctuation", text: line[i++] });
        continue;
      }

      // Catch-all single char
      tokens.push({ type: "text", text: line[i++] });
    }

    result.push({ tokens });
  }

  return result;
}
