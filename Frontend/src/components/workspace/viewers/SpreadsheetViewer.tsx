import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import Editor from "@monaco-editor/react";
import {
  FileSpreadsheet,
  Search,
  Download,
  Copy,
  Check,
  Table,
  Code,
  ArrowUpDown,
  Layers,
  Save,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface SpreadsheetViewerProps {
  content: string;
  filename: string;
  isDirty?: boolean;
  onContentChange?: (newContent: string) => void;
  onSave?: () => Promise<void>;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  content,
  filename,
  isDirty = false,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useTheme();
  const isCsvOrTsv = filename.endsWith(".csv") || filename.endsWith(".tsv");
  const [viewMode, setViewMode] = useState<"table" | "raw">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [sheets, setSheets] = useState<{ name: string; data: (string | number)[][] }[]>([]);
  const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ colIndex: number; direction: "asc" | "desc" } | null>(null);
  const [copied, setCopied] = useState(false);

  // Parse workbook using SheetJS
  useEffect(() => {
    try {
      let workbook: XLSX.WorkBook;

      if (content.startsWith("data:")) {
        // Base64 data URL
        const base64 = content.split(",")[1] || "";
        workbook = XLSX.read(base64, { type: "base64" });
      } else if (isCsvOrTsv) {
        // Raw CSV / TSV text
        workbook = XLSX.read(content, { type: "string" });
      } else {
        // Raw Base64 string fallback
        workbook = XLSX.read(content, { type: "base64" });
      }

      const parsedSheets = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });
        return {
          name: sheetName,
          data: rawJson,
        };
      });

      setSheets(parsedSheets);
      setActiveSheetIndex(0);
    } catch (err) {
      console.error("Failed to parse spreadsheet:", err);
      // Fallback CSV simple split
      if (isCsvOrTsv) {
        const rows = content.split("\n").filter((r) => r.trim() !== "").map((r) => r.split(","));
        setSheets([{ name: "Sheet1", data: rows }]);
      }
    }
  }, [content, filename, isCsvOrTsv]);

  const currentSheet = sheets[activeSheetIndex] || { name: "Sheet1", data: [] };

  const maxColumns = useMemo(() => {
    return currentSheet.data.reduce((max, row) => Math.max(max, row.length), 0);
  }, [currentSheet]);

  const getColumnLetter = (colIdx: number) => {
    let letter = "";
    let temp = colIdx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Extract Column Headers from Row 0 or Column Letters
  const columnHeaders = useMemo(() => {
    if (!currentSheet.data || currentSheet.data.length === 0) return [];
    const firstRow = currentSheet.data[0] || [];

    return Array.from({ length: maxColumns }).map((_, cIdx) => {
      const letter = getColumnLetter(cIdx);
      const titleFromRow0 =
        useFirstRowAsHeader && firstRow[cIdx] !== undefined && String(firstRow[cIdx]).trim() !== ""
          ? String(firstRow[cIdx]).trim()
          : null;

      return {
        index: cIdx,
        letter,
        title: titleFromRow0 || `Col ${letter}`,
        hasCustomTitle: Boolean(titleFromRow0),
      };
    });
  }, [currentSheet, maxColumns, useFirstRowAsHeader]);

  // Filtered and Sorted Table Data Body Rows
  const tableBodyRows = useMemo(() => {
    if (!currentSheet.data || currentSheet.data.length === 0) return [];
    let rows = useFirstRowAsHeader ? currentSheet.data.slice(1) : [...currentSheet.data];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(q))
      );
    }

    // Sort column
    if (sortConfig && rows.length > 0) {
      rows.sort((a, b) => {
        const valA = a[sortConfig.colIndex] ?? "";
        const valB = b[sortConfig.colIndex] ?? "";
        if (typeof valA === "number" && typeof valB === "number") {
          return sortConfig.direction === "asc" ? valA - valB : valB - valA;
        }
        return sortConfig.direction === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [currentSheet, useFirstRowAsHeader, searchQuery, sortConfig]);

  const handleSort = (colIndex: number) => {
    setSortConfig((prev) => {
      if (prev && prev.colIndex === colIndex) {
        return prev.direction === "asc"
          ? { colIndex, direction: "desc" }
          : null;
      }
      return { colIndex, direction: "asc" };
    });
  };

  const handleExportCsv = () => {
    const headerRow = columnHeaders.map((c) => c.title);
    const allRows = useFirstRowAsHeader ? [headerRow, ...tableBodyRows] : tableBodyRows;
    const csvContent = allRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}-${currentSheet.name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = () => {
    const headerRow = columnHeaders.map((c) => c.title);
    const allRows = useFirstRowAsHeader ? [headerRow, ...tableBodyRows] : tableBodyRows;
    const csvContent = allRows.map((row) => row.join("\t")).join("\n");
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden font-sans ${
      isDark ? "bg-black text-neutral-200" : "bg-white text-neutral-800"
    }`}>
      {/* Top Toolbar */}
      <div className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/80 border-neutral-200"
      }`}>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {isCsvOrTsv ? "CSV Spreadsheet" : "Excel Workbook"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter cell values..."
              className={`pl-7 pr-2 py-1 rounded-lg border text-xs outline-none focus:border-emerald-500 w-36 sm:w-48 ${
                isDark ? "bg-neutral-900 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
              }`}
            />
          </div>

          {/* First Row As Headers Toggle */}
          <button
            onClick={() => setUseFirstRowAsHeader((v) => !v)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer border ${
              useFirstRowAsHeader
                ? isDark
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-bold"
                  : "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                : isDark
                ? "border-neutral-800 opacity-60 hover:opacity-100"
                : "border-neutral-200 opacity-60 hover:opacity-100"
            }`}
            title={useFirstRowAsHeader ? "Column headers extracted from Row 1 (Click to use generic A, B, C)" : "Generic A, B, C headers (Click to use Row 1 as headers)"}
          >
            <span>Headers: {useFirstRowAsHeader ? "Row 1" : "A-Z"}</span>
          </button>

          {/* Toggle View for CSV */}
          {isCsvOrTsv && (
            <div className={`flex items-center p-0.5 rounded-lg border ${
              isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
            }`}>
              <button
                onClick={() => setViewMode("table")}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? isDark ? "bg-neutral-800 text-white shadow-xs" : "bg-white text-black shadow-xs"
                    : "opacity-60 hover:opacity-100"
                }`}
                title="Table Grid"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode("raw")}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                  viewMode === "raw"
                    ? isDark ? "bg-neutral-800 text-white shadow-xs" : "bg-white text-black shadow-xs"
                    : "opacity-60 hover:opacity-100"
                }`}
                title="Edit Raw CSV Text"
              >
                <Code className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editor</span>
              </button>
            </div>
          )}

          {/* Copy Table TSV */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Copy as TSV to paste in Excel"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download CSV */}
          <button
            onClick={handleExportCsv}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">CSV</span>
          </button>

          {/* Save Button for CSV Editor */}
          {isDirty && onSave && (
            <button
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Sheet Switcher Tabs (for Excel Multi-Sheet workbooks) */}
      {sheets.length > 1 && (
        <div className={`h-8 px-3 border-b flex items-center gap-1 overflow-x-auto shrink-0 ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-100/70 border-neutral-200"
        }`}>
          <Layers className="w-3.5 h-3.5 opacity-50 mr-1 shrink-0" />
          {sheets.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSheetIndex(idx)}
              className={`px-3 py-1 rounded-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                activeSheetIndex === idx
                  ? isDark ? "bg-neutral-800 text-emerald-400 shadow-xs" : "bg-white text-emerald-700 shadow-xs border border-neutral-200"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              {s.name} ({s.data.length} rows)
            </button>
          ))}
        </div>
      )}

      {/* Main Table Grid View */}
      {viewMode === "table" ? (
        <div className="flex-1 overflow-auto select-text">
          {tableBodyRows.length > 0 || columnHeaders.length > 0 ? (
            <table className="w-full border-collapse font-mono text-xs text-left">
              <thead className={`sticky top-0 z-10 shadow-xs ${
                isDark ? "bg-neutral-900 border-b border-neutral-800" : "bg-neutral-100 border-b border-neutral-300"
              }`}>
                <tr>
                  <th className="w-12 px-2 py-2.5 text-center text-[10px] font-bold opacity-40 border-r border-neutral-800">
                    #
                  </th>
                  {columnHeaders.map((col) => {
                    const isSorted = sortConfig?.colIndex === col.index;
                    return (
                      <th
                        key={col.index}
                        onClick={() => handleSort(col.index)}
                        className={`px-3 py-2.5 font-bold cursor-pointer hover:text-emerald-400 border-r transition-colors select-none ${
                          isDark ? "border-neutral-800 text-neutral-200" : "border-neutral-300 text-neutral-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] px-1 py-0.2 rounded font-mono font-bold bg-neutral-500/20 text-neutral-400 shrink-0">
                              {col.letter}
                            </span>
                            <span className="truncate font-bold text-xs text-inherit" title={col.title}>
                              {col.title}
                            </span>
                          </div>
                          <div className="shrink-0">
                            {isSorted ? (
                              <span className="text-emerald-400 font-bold text-xs">
                                {sortConfig.direction === "asc" ? "▲" : "▼"}
                              </span>
                            ) : (
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableBodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`border-b transition-colors ${
                      isDark
                        ? "hover:bg-neutral-900/80 border-neutral-900"
                        : "hover:bg-neutral-100/80 border-neutral-200"
                    }`}
                  >
                    <td className={`px-2 py-1.5 text-center text-[10px] opacity-40 border-r font-mono ${
                      isDark ? "bg-neutral-950/70 border-neutral-900" : "bg-neutral-100/70 border-neutral-200"
                    }`}>
                      {useFirstRowAsHeader ? rIdx + 2 : rIdx + 1}
                    </td>
                    {columnHeaders.map((col) => (
                      <td
                        key={col.index}
                        className={`px-3 py-1.5 truncate max-w-xs border-r ${
                          isDark ? "border-neutral-900 text-neutral-300" : "border-neutral-200 text-neutral-700"
                        }`}
                      >
                        {String(row[col.index] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center opacity-60 text-xs">
              No data in sheet
            </div>
          )}
        </div>
      ) : (
        /* Raw CSV Code Editor */
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language="plaintext"
            value={content}
            theme={isDark ? "vs-dark" : "light"}
            onChange={(val) => onContentChange && onContentChange(val || "")}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              lineHeight: 22,
              wordWrap: "on",
              minimap: { enabled: false },
            }}
          />
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-500"
      }`}>
        <div className="flex items-center gap-3">
          <span>Rows: {tableBodyRows.length} data rows</span>
          <span>Columns: {columnHeaders.length}</span>
          <span>Active Sheet: {currentSheet.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>SheetJS Engine</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
export default SpreadsheetViewer;
