import React, { useState } from 'react';
import { ShieldCheck, LogIn, LogOut, UserCheck } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import avatarImage from '../assets/images/avatar_executive_user_1794596747028.jpg';

export const AuthPage: React.FC = () => {
  const {
    firebaseUser,
    userProfile,
    signInWithGoogle,
    signOutUser,
    updateUserProfile,
    setActivePage,
  } = useFocusFlow();

  const [imgError, setImgError] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile.displayName);
  const [emailInput, setEmailInput] = useState(userProfile.email);

  const handleQuickProfileRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: nameInput.trim() || userProfile.displayName,
      email: emailInput.trim() || userProfile.email,
    });
    setActivePage('dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="pb-5 border-b border-[#ECEDF5]">
        <h1 className="font-display text-2xl font-bold text-[#14142B]">Account &amp; Authentication</h1>
        <p className="text-sm text-[#7A7D96] mt-0.5">
          Sign in with Google via Firebase Authentication for multi-device Cloud Firestore sync, or customize your local workspace identity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left 5 Cols: Active Profile Card with Generated Studio Avatar + Fallback */}
        <div className="md:col-span-5 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#5B3FE0]/20 border border-[#E2E4F0] flex items-center justify-center">
              {!imgError ? (
                <img
                  src={avatarImage}
                  alt={`${userProfile.displayName} profile portrait`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-2xl font-bold text-[#14142B]">
                  {userProfile.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#14142B]">{userProfile.displayName}</h2>
              <p className="text-xs text-[#7A7D96]">{userProfile.email}</p>
              <p className="text-xs text-[#5B3FE0] mt-1 font-mono">{userProfile.roleTitle}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#ECEDF5] space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#16A34A]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {firebaseUser
                  ? `Firebase UID Verified (${firebaseUser.uid.slice(0, 8)}...)`
                  : 'Authenticated Workspace Session Active'}
              </span>
            </div>
            <p className="text-[#7A7D96]">
              All 10 Firestore collections enforce strict tenant isolation via <code className="font-mono">firestore.rules</code>.
            </p>
          </div>
        </div>

        {/* Right 7 Cols: Google OAuth & Registration Form */}
        <div className="md:col-span-7 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-6">
          <div className="space-y-3">
            <h2 className="font-display text-base font-semibold text-[#14142B]">
              Cloud Sync via Firebase Authentication
            </h2>
            <p className="text-xs text-[#7A7D96]">
              Connect your Google account to persist tasks, schedules, habits, and focus sessions in Cloud Firestore.
            </p>

            {firebaseUser ? (
              <button
                type="button"
                onClick={signOutUser}
                className="w-full py-2.5 px-4 rounded-lg bg-[#ECEDF5] hover:bg-[#E8E9F4] text-[#14142B] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Google ({firebaseUser.email})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full py-2.5 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Continue with Google (Firebase Auth)</span>
              </button>
            )}
          </div>

          <form onSubmit={handleQuickProfileRegistration} className="space-y-4 pt-4 border-t border-[#ECEDF5]">
            <h3 className="font-display text-sm font-semibold text-[#14142B]">
              Workspace Profile Registration
            </h3>
            <div>
              <label htmlFor="auth-name-input" className="block text-xs text-[#5A5C78] mb-1">
                Full Name
              </label>
              <input
                id="auth-name-input"
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
              />
            </div>

            <div>
              <label htmlFor="auth-email-input" className="block text-xs text-[#5A5C78] mb-1">
                Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#ECEDF5] hover:bg-[#E8E9F4] text-[#14142B] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-[#16A34A]" />
              <span>Update Workspace Identity &amp; Enter Dashboard</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
