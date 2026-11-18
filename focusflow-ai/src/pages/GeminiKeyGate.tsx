import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, ExternalLink } from 'lucide-react';
import { setUserGeminiKey } from '../services/gemini';
import { testGeminiKey } from '../services/geminiClient';

type Failure = { kind: string; text: string } | null;

export const GeminiKeyGate: React.FC = () => {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);

  const verifyAndSave = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy(true);
    setFailure(null);
    try {
      const data = await testGeminiKey(key);
      // A valid key with a reached quota is still a real key, so let it in.
      if (data.ok || data.kind === 'quota') {
        setUserGeminiKey(key);
        return;
      }
      setFailure({ kind: data.kind || 'other', text: data.error || 'Key check failed.' });
    } catch {
      setFailure({ kind: 'other', text: 'Could not verify the key. Check your internet connection.' });
    } finally {
      setBusy(false);
    }
  };

  // Only a key Google itself rejected is blocked outright.
  const canSaveAnyway = failure && failure.kind !== 'invalid_key';

  return (
    <div className="min-h-screen bg-[#F4F5FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5B3FE0]/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-[#5B3FE0]" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-[#14142B]">Connect your Gemini API key</h1>
            <p className="text-xs text-[#7A7D96]">Required to use FocusFlow AI</p>
          </div>
        </div>

        <p className="text-sm text-[#5A5C78]">
          FocusFlow AI runs on <strong>your own</strong> Gemini key, so your usage and limits are yours alone. Get a free key
          from Google AI Studio, then paste it below.
        </p>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#5B3FE0] hover:underline"
        >
          <span>Get a Gemini API key</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verifyAndSave()}
            placeholder="Paste your Gemini API key (AIza...)"
            autoComplete="off"
            spellCheck={false}
            aria-label="Gemini API key"
            className="w-full pl-3.5 pr-10 py-2.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
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

        {failure && <p className="text-xs text-[#DC2626]">{failure.text}</p>}

        <button
          type="button"
          onClick={verifyAndSave}
          disabled={busy || !keyInput.trim()}
          className="w-full py-2.5 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] disabled:opacity-40 text-white text-sm font-semibold"
        >
          {busy ? 'Checking key...' : 'Verify & Continue'}
        </button>

        {canSaveAnyway && (
          <button
            type="button"
            onClick={() => setUserGeminiKey(keyInput.trim())}
            className="w-full py-2 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#5A5C78]"
          >
            Save anyway and continue
          </button>
        )}

        <div className="pt-4 border-t border-[#ECEDF5] flex items-start gap-2 text-xs text-[#7A7D96]">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
          <span>
            Your key is saved to your account so you won't be asked again on other devices. It is sent straight from your
            browser to Google, and you can remove or change it any time in Settings.
          </span>
        </div>
      </div>
    </div>
  );
};
