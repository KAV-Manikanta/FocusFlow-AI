import { useSyncExternalStore } from 'react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEY = 'focusflow_gemini_key';
const EVENT = 'focusflow-gemini-key-changed';
const MODEL_STORAGE_KEY = 'focusflow_gemini_model';
const OWNER_KEY = 'focusflow_gemini_key_owner';

/** uid of the signed-in account the key is synced with (null = local only). */
let cloudUid: string | null = null;
const secretsRef = (uid: string) => doc(db, 'user_secrets', uid);

function saveToCloud(uid: string, key: string, model: string): Promise<void> {
  const data: Record<string, unknown> = { userId: uid, geminiKey: key, updatedAt: serverTimestamp() };
  if (model && model !== DEFAULT_GEMINI_MODEL) data.geminiModel = model;
  return setDoc(secretsRef(uid), data);
}
export const DEFAULT_GEMINI_MODEL: string =
  (import.meta.env?.VITE_GEMINI_MODEL as string | undefined) || 'gemini-4-hydrogen';

/** The Gemini model name used for all requests (changeable in Settings). */
export function getGeminiModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setGeminiModel(model: string): void {
  try {
    const m = model.trim();
    if (m && m !== DEFAULT_GEMINI_MODEL) localStorage.setItem(MODEL_STORAGE_KEY, m);
    else localStorage.removeItem(MODEL_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  const key = getUserGeminiKey();
  if (cloudUid && key) saveToCloud(cloudUid, key, getGeminiModel()).catch(() => {});
}

/** The user's Gemini key: cached in this browser and saved to their account so it follows them across devices. */
export function getUserGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setUserGeminiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
    if (cloudUid) localStorage.setItem(OWNER_KEY, cloudUid);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
  if (cloudUid && key.trim()) saveToCloud(cloudUid, key.trim(), getGeminiModel()).catch(() => {});
}

/** Remove the key from this browser only (used on sign-out and account switches). */
export function clearLocalGeminiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MODEL_STORAGE_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Remove the key everywhere: this browser and the signed-in account. */
export function clearUserGeminiKey(): void {
  const uid = cloudUid;
  clearLocalGeminiKey();
  if (uid) deleteDoc(secretsRef(uid)).catch(() => {});
}

/** Call on sign-out so the next person on this device never inherits the key. */
export function detachGeminiAccount(): void {
  cloudUid = null;
  clearLocalGeminiKey();
}

/**
 * Call once a verified user is signed in. Loads their saved key from the account
 * (so a new device needs no re-entry), or uploads an existing local key to it.
 */
export async function syncGeminiKeyWithAccount(uid: string): Promise<void> {
  cloudUid = uid;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== uid) clearLocalGeminiKey(); // key belonged to another account
  } catch {
    /* storage unavailable */
  }
  try {
    const snap = await getDoc(secretsRef(uid));
    const data = snap.exists() ? snap.data() : null;
    const cloudKey = typeof data?.geminiKey === 'string' ? data.geminiKey.trim() : '';
    if (cloudKey) {
      try {
        localStorage.setItem(STORAGE_KEY, cloudKey);
        localStorage.setItem(OWNER_KEY, uid);
        if (typeof data?.geminiModel === 'string' && data.geminiModel) localStorage.setItem(MODEL_STORAGE_KEY, data.geminiModel);
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new Event(EVENT));
      return;
    }
    const local = getUserGeminiKey();
    if (local) {
      await saveToCloud(uid, local, getGeminiModel()); // first sign-in after this feature: migrate it
      try {
        localStorage.setItem(OWNER_KEY, uid);
      } catch {
        /* storage unavailable */
      }
    }
  } catch {
    /* offline or rules not deployed yet: fall back to the browser copy */
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** React hook: the saved key, updating live when it is added or removed. */
export function useGeminiKey(): string {
  return useSyncExternalStore(subscribe, getUserGeminiKey, () => '');
}
