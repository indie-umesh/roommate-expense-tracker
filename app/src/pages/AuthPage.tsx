import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, User, ArrowRight, Loader2 } from "lucide-react";

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithPhonePin, signUpWithPhonePin } = useAuth();

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
      navigate("/groups");
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl mx-auto flex items-center justify-center text-slate-950 font-black text-3xl shadow-lg shadow-emerald-500/20 mb-4">
          ₹
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Roommate
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Lightning-fast expense tracker for flatmates
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#121826] py-8 px-6 sm:px-10 rounded-[28px] border border-white/10 shadow-2xl">
          {/* Segmented Control / Tabs */}
          <div className="flex bg-[#182238] p-1 rounded-xl mb-6 border border-white/5">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !isSignUp
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
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
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isSignUp
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Umesh"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Mobile Number
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-white/10 bg-white/5 text-slate-300 text-sm font-bold">
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
                  className="block w-full px-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-r-xl text-white placeholder-slate-500 text-sm tracking-wider focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                6-Digit Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm tracking-[0.3em] text-center focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Confirm 6-Digit PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm tracking-[0.3em] text-center focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create Account" : "Sign In"}
                  <ArrowRight className="h-4 w-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
