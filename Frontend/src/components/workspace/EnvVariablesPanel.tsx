import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileCode,
  Save,
  RotateCw,
  Sparkles,
} from "lucide-react";
import API_URL from "../../config/api";
import { useAlert } from "../../hooks/useAlert";
import { useTheme } from "../../context/ThemeContext";
import type { Project, EnvVariable } from "../../types/project";

interface EnvVariablesPanelProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
}

export const EnvVariablesPanel: React.FC<EnvVariablesPanelProps> = ({
  project,
  onUpdateProject,
}) => {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useAlert();

  const [envVars, setEnvVars] = useState<EnvVariable[]>(() =>
    project?.envVariables ? [...project.envVariables] : []
  );
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [copiedKeyIdx, setCopiedKeyIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  useEffect(() => {
    if (project?.envVariables) {
      setEnvVars([...project.envVariables]);
    }
  }, [project?.envVariables]);

  const handleAddRow = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!cleanKey) return;

    if (envVars.some((v) => v.key === cleanKey)) {
      showError(`Variable '${cleanKey}' already exists`);
      return;
    }

    setEnvVars((prev) => [...prev, { key: cleanKey, value: newValue }]);
    setNewKey("");
    setNewValue("");
  };

  const handleUpdateRow = (idx: number, field: "key" | "value", val: string) => {
    setEnvVars((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              [field]: field === "key" ? val.toUpperCase().replace(/[^A-Z0-9_]/g, "_") : val,
            }
          : item
      )
    );
  };

  const handleDeleteRow = (idx: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx));
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  const toggleReveal = (idx: number) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCopySingle = (idx: number, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKeyIdx(idx);
    setTimeout(() => setCopiedKeyIdx(null), 1500);
    showSuccess("Copied value");
  };

  const handleCopyAll = () => {
    const raw = envVars.map((v) => `${v.key}=${v.value}`).join("\n");
    navigator.clipboard.writeText(raw);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
    showSuccess("Copied all variables as .env");
  };

  const handleApplyBulk = () => {
    const lines = bulkText.split("\n");
    const parsed: EnvVariable[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (k) parsed.push({ key: k, value: v });
      }
    });

    if (parsed.length === 0) {
      showError("No valid KEY=VALUE pairs found");
      return;
    }

    setEnvVars(parsed);
    setBulkMode(false);
    showSuccess(`Loaded ${parsed.length} variables. Click "Save Variables" to apply.`);
  };

  const handleSave = async () => {
    const projectId = project?._id || (project as any)?.id;
    if (!projectId) {
      showError("Project ID missing");
      return;
    }

    try {
      setIsSaving(true);

      let varsToSave = [...envVars];
      if (newKey.trim()) {
        const cleanKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        if (!varsToSave.some((v) => v.key === cleanKey)) {
          varsToSave.push({ key: cleanKey, value: newValue });
          setNewKey("");
          setNewValue("");
          setEnvVars(varsToSave);
        }
      }

      const res = await fetch(`${API_URL}/api/projects/${projectId}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ envVariables: varsToSave }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save variables");
      }

      if (data.project) {
        onUpdateProject(data.project);
      }
      if (data.envVariables) {
        setEnvVars(data.envVariables);
      }

      showSuccess("Environment variables saved successfully");
    } catch (err: any) {
      showError(err.message || "Failed to save variables");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-neutral-200" : "bg-neutral-50 text-neutral-800"
    }`}>
      {/* Header */}
      <div className={`px-2.5 py-2 border-b flex items-center justify-between gap-1.5 shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <KeyRound className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className={`font-bold text-[11px] uppercase tracking-wider truncate ${
            isDark ? "text-neutral-400" : "text-neutral-500"
          }`}>
            Environment
          </span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
            isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-blue-100 text-blue-700"
          }`}>
            {envVars.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (!bulkMode) {
                setBulkText(envVars.map((v) => `${v.key}=${v.value}`).join("\n"));
              }
              setBulkMode(!bulkMode);
            }}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              bulkMode
                ? "bg-blue-600 text-white"
                : isDark
                ? "hover:bg-neutral-800 text-neutral-400 hover:text-white"
                : "hover:bg-neutral-200 text-neutral-600 hover:text-black"
            }`}
            title={bulkMode ? "Switch to Cards Mode" : "Switch to Raw .env Mode"}
          >
            <FileCode className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyAll}
            disabled={envVars.length === 0}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDark
                ? "hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30"
                : "hover:bg-neutral-200 text-neutral-600 hover:text-black disabled:opacity-30"
            }`}
            title="Copy as .env"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {bulkMode ? (
          /* Raw Textarea Mode */
          <div className="space-y-1.5">
            <p className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Paste or edit raw <code className="font-mono text-blue-400">KEY=VALUE</code> lines:
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              placeholder={"DATABASE_URL=mongodb+srv://...\nPORT=5000\nAPI_KEY=sk_test_12345"}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className={`w-full p-2 font-mono text-[11px] border rounded-lg outline-none focus:border-blue-500 ${
                isDark
                  ? "bg-black border-neutral-800 text-neutral-200 placeholder-neutral-600"
                  : "bg-white border-neutral-300 text-black placeholder-neutral-400"
              }`}
            />
            <button
              type="button"
              onClick={handleApplyBulk}
              className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Apply to List</span>
            </button>
          </div>
        ) : (
          /* Structured Cards Mode */
          <>
            {/* Add New Variable Form */}
            <form
              onSubmit={handleAddRow}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className={`p-2 rounded-xl border space-y-1.5 ${
                isDark ? "bg-black/60 border-neutral-800" : "bg-white border-neutral-200"
              }`}
            >
              {/* Row 1: Key Input */}
              <input
                type="text"
                name="env_var_key_new"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="KEY (e.g. PORT, API_KEY)"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                className={`w-full px-2 py-1.5 text-xs font-mono font-bold border rounded-lg outline-none focus:border-blue-500 ${
                  isDark
                    ? "bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500"
                    : "bg-neutral-50 border-neutral-300 text-black placeholder-neutral-400"
                }`}
              />

              {/* Row 2: Value Input & Add Button */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  name="env_var_val_new"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value (e.g. 5000)"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  className={`flex-1 min-w-0 px-2 py-1.5 text-xs font-mono border rounded-lg outline-none focus:border-blue-500 ${
                    isDark
                      ? "bg-neutral-900 border-neutral-700 text-neutral-200 placeholder-neutral-500"
                      : "bg-neutral-50 border-neutral-300 text-black placeholder-neutral-400"
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newKey.trim()}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                  title="Add Variable"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>

            {/* List of Variables */}
            <div className="space-y-1.5 pt-1">
              {envVars.length === 0 ? (
                <div className={`p-6 text-center italic text-[11px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  <KeyRound className="w-5 h-5 opacity-30 mx-auto mb-1" />
                  <p>No environment variables.</p>
                  <p className="text-[10px] mt-0.5 opacity-60">Add a variable above or use raw mode.</p>
                </div>
              ) : (
                envVars.map((item, idx) => {
                  const isRevealed = revealedKeys.has(idx);
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border space-y-1.5 transition-colors ${
                        isDark ? "bg-black/60 border-neutral-800 hover:border-neutral-700" : "bg-white border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      {/* Top Row: Key Name & Action Bar */}
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            name={`env_key_${idx}`}
                            value={item.key}
                            onChange={(e) => handleUpdateRow(idx, "key", e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-form-type="other"
                            className="w-full bg-transparent font-mono font-bold text-xs text-blue-400 outline-none truncate"
                            placeholder="KEY"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleReveal(idx)}
                            className={`p-1 rounded cursor-pointer transition-colors ${
                              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-100 text-neutral-500 hover:text-black"
                            }`}
                            title={isRevealed ? "Mask value" : "Reveal / edit value"}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-blue-400" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopySingle(idx, item.value)}
                            className={`p-1 rounded cursor-pointer transition-colors ${
                              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-100 text-neutral-500 hover:text-black"
                            }`}
                            title="Copy value"
                          >
                            {copiedKeyIdx === idx ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Delete variable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Full Width Value Input Box */}
                      <div className="relative">
                        {isRevealed ? (
                          <input
                            type="text"
                            name={`env_val_${idx}`}
                            value={item.value}
                            onChange={(e) => handleUpdateRow(idx, "value", e.target.value)}
                            placeholder="value (empty)"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-form-type="other"
                            className={`w-full px-2 py-1 text-xs font-mono border rounded-lg outline-none focus:border-blue-500 ${
                              isDark
                                ? "bg-neutral-900 border-neutral-800 text-neutral-200 placeholder-neutral-600"
                                : "bg-neutral-50 border-neutral-200 text-neutral-800 placeholder-neutral-400"
                            }`}
                          />
                        ) : (
                          <div
                            onClick={() => toggleReveal(idx)}
                            className={`w-full px-2 py-1 text-xs font-mono border rounded-lg cursor-pointer truncate flex items-center justify-between ${
                              isDark
                                ? "bg-neutral-900/70 border-neutral-800/80 text-neutral-500 hover:border-neutral-700"
                                : "bg-neutral-50 border-neutral-200 text-neutral-400 hover:border-neutral-300"
                            }`}
                            title="Click to reveal / edit"
                          >
                            <span className="tracking-widest truncate">
                              {item.value ? "••••••••••••" : <span className="italic tracking-normal opacity-50">(empty)</span>}
                            </span>
                            <span className="text-[10px] text-neutral-500 shrink-0 ml-1">click to edit</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer Save Button */}
      <div className={`p-2 border-t shrink-0 ${isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"}`}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          {isSaving ? <RotateCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          <span>{isSaving ? "Saving Variables..." : "Save Variables"}</span>
        </button>
      </div>
    </div>
  );
};
export default EnvVariablesPanel;
