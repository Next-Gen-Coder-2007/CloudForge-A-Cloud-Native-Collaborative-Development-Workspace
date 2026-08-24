import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { FileIcon } from "./FileIcon";
import { type WorkspaceFile } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface SearchPanelProps {
  files: WorkspaceFile[];
  onSelectMatch: (file: WorkspaceFile, lineNumber?: number) => void;
}

interface MatchResult {
  file: WorkspaceFile;
  matches: {
    lineNumber: number;
    lineText: string;
    matchIndex: number;
  }[];
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  files,
  onSelectMatch,
}) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const searchResults: MatchResult[] = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];

    const results: MatchResult[] = [];
    const searchQuery = matchCase ? query : query.toLowerCase();

    files.forEach((file) => {
      if (file.type !== "file" || !file.content) return;

      const lines = file.content.split("\n");
      const fileMatches: MatchResult["matches"] = [];

      lines.forEach((line, index) => {
        const textToSearch = matchCase ? line : line.toLowerCase();
        const matchIdx = textToSearch.indexOf(searchQuery);

        if (matchIdx !== -1) {
          fileMatches.push({
            lineNumber: index + 1,
            lineText: line.trim(),
            matchIndex: matchIdx,
          });
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          file,
          matches: fileMatches,
        });
      }
    });

    return results;
  }, [files, query, matchCase]);

  const totalMatches = searchResults.reduce(
    (sum, r) => sum + r.matches.length,
    0
  );

  const toggleFileCollapse = (fileId: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-white" : "bg-neutral-50/70 text-black"
    }`}>
      <div className={`px-2.5 py-2 border-b ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white/60 border-neutral-200"
      }`}>
        <span className={`text-[11px] font-bold tracking-wider uppercase ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
          Search
        </span>
      </div>

      <div className={`p-3 border-b space-y-2 ${
        isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all files..."
            className={`w-full pl-7 pr-14 py-1.5 border rounded-lg text-xs outline-none focus:border-blue-500 transition-all shadow-2xs ${
              isDark ? "bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500" : "bg-neutral-50 border-neutral-300 text-black placeholder-neutral-400"
            }`}
          />
          <Search className={`w-3.5 h-3.5 absolute left-2 ${isDark ? "text-neutral-500" : "text-neutral-400"}`} />

          <div className="absolute right-1.5 flex items-center gap-1">
            <button
              onClick={() => setMatchCase(!matchCase)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                matchCase
                  ? "bg-blue-600 text-white"
                  : isDark
                  ? "text-neutral-400 hover:text-white bg-neutral-800"
                  : "text-neutral-500 hover:text-black bg-neutral-100"
              }`}
              title="Match Case (Aa)"
            >
              Aa
            </button>
          </div>
        </div>

        {query.trim() && (
          <div className={`text-[11px] font-medium ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            {totalMatches} {totalMatches === 1 ? "result" : "results"} in{" "}
            {searchResults.length} {searchResults.length === 1 ? "file" : "files"}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-xs">
        {!query.trim() ? (
          <div className={`py-12 text-center text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Type to search across workspace</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className={`py-12 text-center text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            <p>No results found for "{query}"</p>
          </div>
        ) : (
          searchResults.map(({ file, matches }) => {
            const isCollapsed = collapsedFiles.has(file._id);

            return (
              <div key={file._id} className={`rounded-xl border overflow-hidden shadow-2xs ${
                isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
              }`}>
                <div
                  onClick={() => toggleFileCollapse(file._id)}
                  className={`px-2 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isDark ? "bg-neutral-900/80 hover:bg-neutral-900" : "bg-neutral-50/80 hover:bg-neutral-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={isDark ? "text-neutral-500" : "text-neutral-400"}>
                      {isCollapsed ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </span>
                    <FileIcon name={file.name} type={file.type} className="w-3.5 h-3.5 shrink-0" />
                    <span className={`font-semibold truncate ${isDark ? "text-white" : "text-black"}`}>{file.name}</span>
                    <span className={`text-[10px] truncate ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{file.path}</span>
                  </div>

                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isDark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-200 text-neutral-700"
                  }`}>
                    {matches.length}
                  </span>
                </div>

                {!isCollapsed && (
                  <div className={`p-1 space-y-0.5 ${isDark ? "bg-black" : "bg-white"}`}>
                    {matches.map((match, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectMatch(file, match.lineNumber)}
                        className={`px-2 py-1 rounded cursor-pointer flex items-center gap-2 text-[11px] transition-colors ${
                          isDark ? "hover:bg-neutral-900 text-neutral-300" : "hover:bg-blue-50 text-neutral-700"
                        }`}
                      >
                        <span className={`w-6 shrink-0 text-right font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                          {match.lineNumber}:
                        </span>
                        <span className={`truncate ${isDark ? "text-white" : "text-black"}`}>
                          {match.lineText}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
