import React, { useRef, useState } from 'react';
import { Download, Database, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { buildBackup, buildDemoData, downloadJson, validateBackup, ImportableTask } from '../lib/dataPortability';
import type { Habit } from '../types';

type Pending = { tasks: ImportableTask[]; habits: Habit[] };

const card = 'rounded-2xl border p-5 flex flex-col gap-3 bg-white';
const btnPrimary =
  'mt-auto py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#4F3BD9] to-[#7A3FEA] text-white shadow-[0_6px_16px_rgba(91,63,224,0.3)] disabled:opacity-50';
const btnOutline =
  'mt-auto py-2.5 px-4 rounded-xl text-xs font-semibold border border-[#5B3FE0]/40 text-[#5B3FE0] hover:bg-[#EDE9FE] disabled:opacity-50';
const btnDanger = 'mt-auto py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#EF4444] hover:bg-[#DC2626] text-white disabled:opacity-50';
const btnGhost = 'py-2 px-3.5 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#5A5C78] disabled:opacity-50';

export const DataPortability: React.FC = () => {
  const { tasks, habits, importWorkspaceData, resetAllData, addToast } = useFocusFlow();

  const demoCounts = React.useMemo(() => {
    const d = buildDemoData();
    return { tasks: d.tasks.length, habits: d.habits.length };
  }, []);
  const [confirm, setConfirm] = useState<null | 'demo' | 'reset'>(null);
  const [busy, setBusy] = useState(false);

  const [payload, setPayload] = useState('');
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  const clearImport = () => {
    setPayload('');
    setFileName('');
    setErrors([]);
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = () => {
    downloadJson(`focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`, buildBackup(tasks, habits));
    addToast('Backup downloaded', `${tasks.length} tasks and ${habits.length} habits exported.`, 'success');
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(['That file is larger than 5 MB.']);
      setPending(null);
      return;
    }
    setFileName(file.name);
    setPayload(await file.text());
    setErrors([]);
    setPending(null);
  };

  const handleValidate = () => {
    setPending(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      setErrors([`This is not valid JSON: ${(err as Error).message}`]);
      return;
    }
    const result = validateBackup(parsed);
    if (result.ok === false) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPending({ tasks: result.tasks, habits: result.habits });
  };

  const handleImport = () =>
    run(async () => {
      if (!pending) return;
      await importWorkspaceData(pending, mode);
      clearImport();
    });

  return (
    <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-display text-base font-bold text-[#14142B]">Data Storage &amp; Portability</h2>
        <p className="text-xs text-[#7A7D96] mt-0.5">
          You currently have {tasks.length} tasks and {habits.length} habits. Back them up, move them to another
          device, or start fresh.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} border-[#ECEDF5]`}>
          <h3 className="text-sm font-bold text-[#14142B]">Export Backup JSON</h3>
          <p className="text-xs text-[#7A7D96]">Download all tasks and habits as a portable JSON file.</p>
          <button type="button" onClick={handleExport} className={btnPrimary}>
            <Download className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
            Download JSON Backup
          </button>
        </div>

        <div className={`${card} border-[#ECEDF5]`}>
          <h3 className="text-sm font-bold text-[#14142B]">Load Demo Dataset</h3>
          <p className="text-xs text-[#7A7D96]">
            Seed {demoCounts.tasks} sample tasks and {demoCounts.habits} habits across every category, with deadlines and streaks set relative
            to today. Replaces your current tasks and habits.
          </p>
          {confirm === 'demo' ? (
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} className={btnPrimary + ' !mt-0'} onClick={() => run(() => importWorkspaceData(buildDemoData(), 'replace'))}>
                {busy ? 'Loading...' : 'Yes, replace'}
              </button>
              <button type="button" disabled={busy} className={btnGhost} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={btnOutline} onClick={() => setConfirm('demo')}>
              <Database className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
              Load Demo Data
            </button>
          )}
        </div>

        <div className={`${card} border-[#EF4444]/30`}>
          <h3 className="text-sm font-bold text-[#DC2626]">Reset All Data</h3>
          <p className="text-xs text-[#7A7D96]">
            Permanently deletes all tasks, focus sessions, habits, schedules, notifications and chat history, in the
            cloud and in this browser. Your account and Gemini key are kept.
          </p>
          {confirm === 'reset' ? (
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} className={btnDanger + ' !mt-0'} onClick={() => run(resetAllData)}>
                {busy ? 'Deleting...' : 'Yes, delete everything'}
              </button>
              <button type="button" disabled={busy} className={btnGhost} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={btnDanger} onClick={() => setConfirm('reset')}>
              <Trash2 className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
              Reset All Data
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-[#ECEDF5] pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#14142B]">Import JSON Data (Schema Validated)</h3>
          <p className="text-xs text-[#7A7D96] mt-0.5">
            Upload an exported <code className="font-mono text-[#5A5C78]">.json</code> file or paste JSON below. Every
            task and habit is validated before you are asked to confirm.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-[#14142B]">Select JSON File:</span>
          <label className="py-2 px-3.5 rounded-lg bg-[#EDE9FE] hover:bg-[#E0D9FC] text-[#5B3FE0] text-xs font-semibold cursor-pointer">
            Choose File
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="sr-only" />
          </label>
          <span className="text-xs text-[#5A5C78]">{fileName || 'No file chosen'}</span>
        </div>

        <div>
          <label htmlFor="ff-import-json" className="block text-xs font-semibold text-[#14142B] mb-1.5">
            Or Paste JSON Backup Payload
          </label>
          <textarea
            id="ff-import-json"
            value={payload}
            onChange={(e) => {
              setPayload(e.target.value);
              setErrors([]);
              setPending(null);
            }}
            rows={6}
            spellCheck={false}
            placeholder='{"tasks":[...],"habits":[...]}'
            className="w-full rounded-xl bg-[#F4F5FA] border border-[#ECEDF5] focus:border-[#5B3FE0] outline-none p-3 text-xs font-mono text-[#14142B] placeholder-[#9A9CB3]"
          />
        </div>

        {errors.length > 0 && (
          <div className="rounded-xl border border-[#EF4444]/30 bg-[#FEF2F2] p-3.5" role="alert">
            <p className="text-xs font-semibold text-[#DC2626] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Nothing was imported. Fix these problems and try again:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[#991B1B] list-disc pl-5 max-h-40 overflow-y-auto">
              {errors.slice(0, 25).map((er, i) => (
                <li key={i}>{er}</li>
              ))}
              {errors.length > 25 && <li>...and {errors.length - 25} more.</li>}
            </ul>
          </div>
        )}

        {pending && (
          <div className="rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4] p-3.5 space-y-3">
            <p className="text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Valid: {pending.tasks.length} tasks and {pending.habits.length} habits ready to import.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 text-xs text-[#14142B]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ff-import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                Add to my existing tasks and habits
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ff-import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                Overwrite everything (deletes current tasks and habits)
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={handleImport} className={btnPrimary + ' !mt-0'}>
                {busy ? 'Importing...' : mode === 'replace' ? 'Confirm overwrite & import' : 'Confirm import'}
              </button>
              <button type="button" disabled={busy} onClick={clearImport} className={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!pending && (
          <div className="flex gap-2">
            <button type="button" disabled={!payload.trim()} onClick={handleValidate} className={btnPrimary + ' !mt-0'}>
              <Upload className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
              Validate JSON
            </button>
            {(payload || fileName) && (
              <button type="button" onClick={clearImport} className={btnGhost}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
