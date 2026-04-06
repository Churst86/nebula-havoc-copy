import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Download, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { loadAllSaveFiles, exportSaveSlotAsJson, importSavesFromJson, getAvailableSlotsInJson } from '../../lib/gameSettings';

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Challenging',
  hell: 'Hell',
};

const SLOT_META = [
  { key: 'slot1', label: 'Save Slot 1', accent: '#4dd0ff' },
  { key: 'slot2', label: 'Save Slot 2', accent: '#8f9bff' },
  { key: 'slot3', label: 'Save Slot 3', accent: '#7dffb2' },
  { key: 'auto', label: 'Autosave', accent: '#ffc14d' },
];

function formatSave(save) {
  if (!save) return 'Empty';
  const difficulty = DIFFICULTY_LABELS[save.difficulty] || 'Easy';
  const wave = save.wave || 1;
  const score = (save.blockScore || 0).toLocaleString();
  const stamp = save.savedAt
    ? new Date(save.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown time';
  return `${difficulty} · Wave ${wave} · Blocks ${score} · ${stamp}`;
}

export default function SavedGamesScreen({ saves: initialSaves, onLoad, onBack }) {
  const [saves, setSaves] = useState(() => initialSaves || loadAllSaveFiles());
  const [importStatus, setImportStatus] = useState(null); // null | { ok, message }
  const [exportStatus, setExportStatus] = useState(null); // null | { ok, message }
  const [exportSlot, setExportSlot] = useState('slot1');
  const [importSlotSelection, setImportSlotSelection] = useState(null); // null | { auto, slot1, slot2, slot3 } with preview strings
  const [importFileContent, setImportFileContent] = useState(null); // raw JSON content
  const [slotMapping, setSlotMapping] = useState({}); // { sourceSlot: targetSlot }
  const fileInputRef = useRef(null);

  const applyImportJson = (jsonString, mapping = null) => {
    const result = importSavesFromJson(jsonString, { slotMapping: mapping });
    setImportStatus(result);
    if (result.ok) {
      setSaves(loadAllSaveFiles());
    }
    setTimeout(() => setImportStatus(null), 4000);
  };

  const makeExportFileName = (slotKey) => {
    const slot = SLOT_META.find((x) => x.key === slotKey);
    const base = (slot?.label || slotKey || 'save-export')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `${base || 'save-export'}.json`;
  };

  const handleExport = async () => {
    const json = exportSaveSlotAsJson(exportSlot);
    if (!json) {
      setExportStatus({ ok: false, message: 'That slot is empty. Pick a slot with a save first.' });
      setTimeout(() => setExportStatus(null), 4000);
      return;
    }

    const fileName = makeExportFileName(exportSlot);
    const desktopApi = window?.desktopApp;

    // Try Electron first
    if (desktopApi?.isElectron && typeof desktopApi.exportSaveSlot === 'function') {
      try {
        const result = await desktopApi.exportSaveSlot({ json, fileName, slot: exportSlot });
        if (!result?.ok) {
          setExportStatus({ ok: false, message: result?.error || 'Export failed.' });
        } else {
          const path = result.filePath || 'save folder';
          setExportStatus({ ok: true, message: `Exported to:\n${path}` });
        }
      } catch (err) {
        setExportStatus({ ok: false, message: err?.message || 'Export failed.' });
      }
      setTimeout(() => setExportStatus(null), 5000);
      return;
    }

    // Try dev API endpoint (localhost development)
    try {
      const devResult = await fetch('/api/dev/export-save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, content: json }),
      });
      if (devResult.ok) {
        const data = await devResult.json();
        if (data.ok) {
          const path = data.filePath || 'save folder';
          setExportStatus({ ok: true, message: `Exported to:\n${path}` });
          setTimeout(() => setExportStatus(null), 5000);
          return;
        } else if (data.error) {
          console.warn('[Dev API] Export error:', data.error);
        }
      } else {
        console.warn('[Dev API] Export request failed with status:', devResult.status);
      }
    } catch (err) {
      console.warn('[Dev API] Export failed:', err?.message);
      // Dev API not available, fall through to browser download
    }

    // Fallback: browser download (web version only)
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportStatus({ ok: true, message: `Downloaded as ${fileName}` });
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      const available = getAvailableSlotsInJson(content);
      setImportFileContent(content);
      setImportSlotSelection(available);
      // Pre-map all available source slots to themselves
      const initialMapping = {};
      Object.entries(available).forEach(([slot, preview]) => {
        if (preview !== null) initialMapping[slot] = slot;
      });
      setSlotMapping(initialMapping);
    };
    reader.readAsText(file);
  };

  const handleImportClick = async () => {
    const desktopApi = window?.desktopApp;
    if (desktopApi?.isElectron && typeof desktopApi.pickImportSaveFile === 'function') {
      try {
        const result = await desktopApi.pickImportSaveFile();
        if (!result?.ok) {
          if (!result?.cancelled) {
            setImportStatus({ ok: false, message: result?.error || 'Failed to open file picker.' });
            setTimeout(() => setImportStatus(null), 4000);
          }
          return;
        }
        const content = result.content;
        const available = getAvailableSlotsInJson(content);
        setImportFileContent(content);
        setImportSlotSelection(available);
        // Pre-map all available source slots to themselves
        const initialMapping = {};
        Object.entries(available).forEach(([slot, preview]) => {
          if (preview !== null) initialMapping[slot] = slot;
        });
        setSlotMapping(initialMapping);
      } catch (err) {
        setImportStatus({ ok: false, message: err?.message || 'Failed to import save file.' });
        setTimeout(() => setImportStatus(null), 4000);
      }
      return;
    }

    fileInputRef.current?.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 overflow-y-auto bg-black/85 backdrop-blur-md"
    >
      <div className="flex min-h-full items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ awtype: 'spring', stiffness: 210, damping: 20 }}
        className="w-full max-w-lg space-y-4 py-4 md:py-7"
      >
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          SAVED GAMES
        </h1>

        <div className="space-y-2">
          {SLOT_META.map((slot) => {
            const save = saves?.[slot.key] || null;
            const isEmpty = !save;
            return (
              <button
                key={slot.key}
                onClick={() => !isEmpty && onLoad?.(slot.key)}
                disabled={isEmpty}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${isEmpty ? 'opacity-55 cursor-not-allowed' : 'hover:translate-y-[-1px]'}`}
                style={{
                  borderColor: isEmpty ? '#28314b' : slot.accent,
                  background: isEmpty ? '#0a1020' : `${slot.accent}18`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black tracking-wide" style={{ color: isEmpty ? '#6f7a98' : slot.accent }}>
                    {slot.label}
                  </div>
                  {!isEmpty && <Play className="w-4 h-4" style={{ color: slot.accent }} />}
                </div>
                <div className="mt-1 text-xs md:text-sm text-slate-200/85">{formatSave(save)}</div>
              </button>
            );
          })}
        </div>

        {/* ── Cross-platform save portability ── */}
        <div className="rounded-xl border border-slate-600/40 bg-slate-900/60 p-3 space-y-2">
          <div className="text-xs text-slate-400 font-mono tracking-wide uppercase">Cross-Platform Saves</div>
          <p className="text-xs text-slate-400/80">
            Pick a slot to export, then import it on any platform (web, desktop, mobile).
          </p>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 uppercase tracking-wide font-mono">Export Slot</label>
            <select
              value={exportSlot}
              onChange={(e) => setExportSlot(e.target.value)}
              className="w-full rounded-lg border border-slate-600/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400"
            >
              {SLOT_META.map((slot) => (
                <option key={slot.key} value={slot.key}>{slot.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-cyan-500/50 text-cyan-300 hover:bg-cyan-950/40 text-xs"
              onClick={handleExport}
            >
              <Download className="w-3.5 h-3.5" />
              Export Saves
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-violet-500/50 text-violet-300 hover:bg-violet-950/40 text-xs"
              onClick={handleImportClick}
            >
              <Upload className="w-3.5 h-3.5" />
              Import Saves
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
          {exportStatus && (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 font-mono whitespace-pre-wrap ${exportStatus.ok ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/40' : 'bg-red-950/60 text-red-300 border border-red-500/40'}`}>
              {exportStatus.ok
                ? <><CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {exportStatus.message}</>
                : <><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {exportStatus.message}</>
              }
            </div>
          )}
          {importStatus && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 font-mono ${importStatus.ok ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40' : 'bg-red-950/60 text-red-300 border border-red-500/40'}`}>
              {importStatus.ok
                ? <><CheckCircle className="w-3.5 h-3.5 shrink-0" /> Saves imported successfully.</>
                : <><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {importStatus.message}</>
              }
            </div>
          )}
        </div>

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
      </div>

      {/* ── Import Slot Selection Dialog ── */}
      {importSlotSelection && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 210, damping: 20 }}
            className="relative bg-slate-900 border border-slate-600/60 rounded-xl p-6 max-w-md w-full mx-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-cyan-300">Select Slots to Import</h2>
              <button
                onClick={() => {
                  setImportSlotSelection(null);
                  setImportFileContent(null);
                  setSlotMapping({});
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Choose where to import each save slot:
            </p>

            <div className="space-y-2">
              {['auto', 'slot1', 'slot2', 'slot3'].map((sourceSlot) => {
                const preview = importSlotSelection?.[sourceSlot];
                if (!preview) return null; // Skip empty slots
                const sourceLabel = sourceSlot === 'auto' ? 'Autosave' : `Save Slot ${sourceSlot.slice(4)}`;
                
                return (
                  <div key={sourceSlot} className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-600/40">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200">{sourceLabel}</div>
                      <div className="text-xs text-slate-400">{preview}</div>
                    </div>
                    <div className="text-slate-400">→</div>
                    <select
                      value={slotMapping[sourceSlot] || sourceSlot}
                      onChange={(e) => {
                        setSlotMapping((prev) => ({
                          ...prev,
                          [sourceSlot]: e.target.value,
                        }));
                      }}
                      className="px-2 py-1 rounded bg-slate-950/60 border border-slate-600/70 text-xs text-slate-200 outline-none focus:border-cyan-400"
                    >
                      <option value="auto">Autosave</option>
                      <option value="slot1">Slot 1</option>
                      <option value="slot2">Slot 2</option>
                      <option value="slot3">Slot 3</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  if (importFileContent && Object.keys(slotMapping).length > 0) {
                    applyImportJson(importFileContent, slotMapping);
                    setImportSlotSelection(null);
                    setImportFileContent(null);
                    setSlotMapping({});
                  }
                }}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold"
              >
                Import Now
              </Button>
              <Button
                onClick={() => {
                  setImportSlotSelection(null);
                  setImportFileContent(null);
                  setSlotMapping({});
                }}
                variant="outline"
                className="flex-1 text-sm"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
