import React, { useState } from 'react';
import { LogIn, Sparkles } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../services/firebase';

export const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#F4F5FB] flex items-center justify-center">
    <div className="flex items-center gap-3 text-sm text-[#7A7D96]">
      <div className="w-4 h-4 rounded-full border-2 border-[#5B3FE0] border-t-transparent animate-spin" />
      <span>Loading FocusFlow AI...</span>
    </div>
  </div>
);

export const SignInGate: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // The auth listener takes over from here.
    } catch (e: any) {
      const code = String(e?.code || '');
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError(null);
      } else if (code === 'auth/unauthorized-domain') {
        setError('This website address is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.');
      } else if (code === 'auth/popup-blocked') {
        setError('Your browser blocked the sign-in popup. Allow popups for this site and try again.');
      } else {
        setError(e?.message || 'Sign-in failed. Please try again.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-8 space-y-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#5B3FE0]/20 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-[#5B3FE0]" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14142B]">FocusFlow AI</h1>
          <p className="text-sm text-[#7A7D96] mt-1">Intelligent personal productivity assistant</p>
        </div>
        <p className="text-sm text-[#5A5C78]">Sign in with your Google account to open your private workspace.</p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          <span>{busy ? 'Waiting for Google...' : 'Sign in with Google'}</span>
        </button>

        {error && <p className="text-xs text-[#DC2626] text-left">{error}</p>}

        <p className="text-xs text-[#9A9CB3]">Your tasks are stored privately under your own account.</p>
      </div>
    </div>
  );
};
