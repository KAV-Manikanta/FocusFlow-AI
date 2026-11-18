import React, { useState } from 'react';
import { Save, KeyRound, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { DataPortability } from '../components/DataPortability';
import {
  setUserGeminiKey,
  clearUserGeminiKey,
  useGeminiKey,
  getGeminiModel,
  setGeminiModel,
  DEFAULT_GEMINI_MODEL,
} from '../services/gemini';
import { testGeminiKey } from '../services/geminiClient';

export const SettingsPage: React.FC = () => {
  const { userProfile, updateUserProfile } = useFocusFlow();

  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [roleTitle, setRoleTitle] = useState(userProfile.roleTitle);
  const [timezone, setTimezone] = useState(userProfile.timezone);
  const [workStartHour, setWorkStartHour] = useState(userProfile.workStartHour);
  const [workEndHour, setWorkEndHour] = useState(userProfile.workEndHour);
  const [dailyFocusGoalMinutes, setDailyFocusGoalMinutes] = useState(userProfile.dailyFocusGoalMinutes);
  const [mlConsent, setMlConsent] = useState(userProfile.mlConsent);

  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(getGeminiModel());
  const savedKey = useGeminiKey();
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const maskKey = (k: string) => (k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : '••••••••');

  const testKey = async (candidate?: string) => {
    setKeyBusy(true);
    setKeyStatus(null);
    try {
      const data = await testGeminiKey(candidate);
      const usable = Boolean(data.ok) || data.kind === 'quota';
      setKeyStatus(
        data.ok
          ? { ok: true, text: `Key works (${data.model}).` }
          : { ok: false, text: data.error || 'Key check failed.' }
      );
      return usable;
    } catch {
      setKeyStatus({ ok: false, text: 'Could not verify the key. Check your internet connection.' });
      return false;
    } finally {
      setKeyBusy(false);
    }
  };

  const handleSaveKey = async () => {
    const k = keyInput.trim();
    if (!k) return;
    const ok = await testKey(k);
    if (ok) {
      setUserGeminiKey(k);
      setKeyInput('');
    }
  };

  const handleRemoveKey = () => {
    clearUserGeminiKey(); // the app locks and asks for a new key
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: displayName.trim() || 'FocusFlow User',
      roleTitle: roleTitle.trim() || 'Professional',
      timezone,
      workStartHour: Number(workStartHour),
      workEndHour: Number(workEndHour),
      dailyFocusGoalMinutes: Number(dailyFocusGoalMinutes),
      mlConsent,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-5 border-b border-[#ECEDF5]">
        <h1 className="font-display text-2xl font-bold text-[#14142B]">User Settings</h1>
        <p className="text-sm text-[#7A7D96] mt-0.5">
          Manage your profile, timezone, working hours, and focus targets.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-name" className="block text-xs text-[#5A5C78] mb-1">
              Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
            />
          </div>

          <div>
            <label htmlFor="settings-role" className="block text-xs text-[#5A5C78] mb-1">
              Role / Academic Track
            </label>
            <input
              id="settings-role"
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-tz" className="block text-xs text-[#5A5C78] mb-1">
              Display Timezone (UTC Stored)
            </label>
            <input
              id="settings-tz"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
            />
          </div>

          <div>
            <label htmlFor="settings-start" className="block text-xs text-[#5A5C78] mb-1">
              Workday Start Hour (0–22)
            </label>
            <input
              id="settings-start"
              type="number"
              min={0}
              max={22}
              value={workStartHour}
              onChange={(e) => setWorkStartHour(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
            />
          </div>

          <div>
            <label htmlFor="settings-end" className="block text-xs text-[#5A5C78] mb-1">
              Workday End Hour (1–24)
            </label>
            <input
              id="settings-end"
              type="number"
              min={1}
              max={24}
              value={workEndHour}
              onChange={(e) => setWorkEndHour(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-focus-goal" className="block text-xs text-[#5A5C78] mb-1">
            Daily Deep Focus Goal (Minutes)
          </label>
          <input
            id="settings-focus-goal"
            type="number"
            min={30}
            max={600}
            step={15}
            value={dailyFocusGoalMinutes}
            onChange={(e) => setDailyFocusGoalMinutes(Number(e.target.value))}
            className="w-full max-w-xs px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
          />
        </div>

        <div className="pt-3 border-t border-[#ECEDF5] flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#14142B]">
              Consent to Personalized Machine Learning Adaptation
            </p>
            <p className="text-xs text-[#7A7D96]">
              When enabled, completed task durations and focus sessions calibrate the Random Forest and Gradient Boosting models. When disabled, rule-based baseline heuristics are used.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mlConsent}
            onClick={() => setMlConsent((c) => !c)}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold shrink-0 ${
              mlConsent ? 'bg-[#22C55E]/20 text-[#16A34A]' : 'bg-[#F4F5FA] text-[#7A7D96]'
            }`}
          >
            {mlConsent ? 'CONSENTED' : 'FALLBACK ONLY'}
          </button>
        </div>

        <div className="pt-4 border-t border-[#ECEDF5] flex flex-wrap items-center justify-between gap-3">
          <span />

          <button
            type="submit"
            className="py-2.5 px-6 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-[#5B3FE0] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-[#14142B]">Gemini API Key</h2>
            <p className="text-xs text-[#7A7D96] mt-0.5">
              Your key powers the AI assistant and ML explanations. It is saved to your account, so it follows you to any device you
              sign in on, and is sent straight from your browser to Google. Paste a new key here any time your limit runs out. Removing it locks the
              app until you add another.
            </p>
          </div>
        </div>

        <p className="text-xs text-[#5A5C78]">
          Current key:{' '}
          <span className="font-mono text-[#14142B]">
            {maskKey(savedKey)}
          </span>
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste new Gemini API key (AIza...)"
              autoComplete="off"
              spellCheck={false}
              aria-label="Gemini API key"
              className="w-full pl-3.5 pr-10 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A7D96] hover:text-[#14142B]"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={keyBusy || !keyInput.trim()}
            className="py-2 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] disabled:opacity-40 text-white text-xs font-semibold"
          >
            {keyBusy ? 'Checking...' : 'Test & Save'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="gemini-model" className="text-xs text-[#5A5C78] shrink-0">
            Model name
          </label>
          <input
            id="gemini-model"
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onBlur={() => setGeminiModel(modelInput || DEFAULT_GEMINI_MODEL)}
            spellCheck={false}
            className="flex-1 px-3 py-1.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-xs text-[#14142B] font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setGeminiModel(modelInput || DEFAULT_GEMINI_MODEL);
              testKey();
            }}
            disabled={keyBusy}
            className="py-1.5 px-3 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#5A5C78]"
          >
            Test current key
          </button>
          {savedKey && (
            <button
              type="button"
              onClick={handleRemoveKey}
              className="py-1.5 px-3 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#5A5C78] flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove my key</span>
            </button>
          )}
          {keyStatus && (
            <span className={`text-xs flex items-center gap-1.5 ${keyStatus.ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {keyStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {keyStatus.text}
            </span>
          )}
        </div>
      </div>

      <DataPortability />
    </div>
  );
};
