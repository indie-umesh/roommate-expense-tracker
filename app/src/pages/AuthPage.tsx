import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Lock, User, ArrowRight, Loader2, Sun, Moon } from "lucide-react";

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithPhonePin, signUpWithPhonePin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    if (isSignUp) {
      if (!displayName.trim()) {
        setError("Please enter your name");
        return;
      }
      if (pin !== confirmPin) {
        setError("PINs do not match");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithPhonePin(cleanPhone, pin, displayName.trim());
      } else {
        await signInWithPhonePin(cleanPhone, pin);
      }

      // Check if user already has a group and route directly into their flat
      const { data: userGroups } = await supabase
        .from("groups")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);

      if (userGroups && userGroups.length > 0) {
        navigate(`/group/${userGroups[0].id}`, { replace: true });
      } else {
        navigate("/setup", { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 relative transition-colors duration-200">
      {/* Theme Switcher Button - Available before login */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          className="btn-surface px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
        >
          {theme === "light" ? (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light</span>
            </>
          )}
        </button>
      </div>

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center text-white font-black text-2xl mb-4 shadow-sm">
          ₹
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Roommate
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)] font-normal">
          Split bills & settle debts in seconds
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card-clean p-6 sm:p-8">
          {/* Segmented Minimal Tabs */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl mb-6 border border-slate-200/80 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer ${
                !isSignUp
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer ${
                isSignUp
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Umesh"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Mobile Number
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-[var(--text-primary)] text-sm font-semibold">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-r-xl text-[var(--text-primary)] placeholder-slate-400 text-sm tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                6-Digit Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] placeholder-slate-400 text-sm tracking-[0.3em] text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Confirm 6-Digit PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••••"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] placeholder-slate-400 text-sm tracking-[0.3em] text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                  />
                </div>
              </div>
            )}

            {/* Flat Minimal CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold btn-primary disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  <span>{isSignUp ? "Create Flat Account" : "Sign In"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
