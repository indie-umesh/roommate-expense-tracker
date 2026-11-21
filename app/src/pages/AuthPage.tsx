import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, User, ArrowRight, Loader2 } from "lucide-react";

export const AuthPage: React.FC = () => {
  const { signInWithPhonePin, signUpWithPhonePin } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError("Security PIN must be exactly 6 digits");
      return;
    }

    if (isSignUp) {
      if (pin !== confirmPin) {
        setError("PINs do not match");
        return;
      }
      if (!displayName.trim()) {
        setError("Please enter your name");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithPhonePin(cleanPhone, pin, displayName);
      } else {
        await signInWithPhonePin(cleanPhone, pin);
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 bg-[#0066cc] rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
          ₹
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          Roommate
        </h1>
        <p className="mt-1.5 text-[15px] text-[#86868b] tracking-normal">
          Fast, 3-tap expense splitting and settlements
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[22px] border border-[#e5e5e7] shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          {/* Segmented Control / Tabs */}
          <div className="flex bg-[#f5f5f7] p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-center text-sm font-medium rounded-lg transition-all ${
                !isSignUp
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
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
              className={`flex-1 py-1.5 text-center text-sm font-medium rounded-lg transition-all ${
                isSignUp
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Umesh"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] text-sm focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/15 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-1.5">
                Mobile Number
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-[#d2d2d7] bg-[#f5f5f7] text-[#1d1d1f] text-sm font-semibold">
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
                  className="block w-full px-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-r-xl text-[#1d1d1f] placeholder-[#86868b] text-sm tracking-wider focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/15 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-1.5">
                6-Digit Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b]">
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
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] text-sm tracking-[0.3em] text-center focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/15 transition"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-1.5">
                  Confirm 6-Digit PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b]">
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
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] text-sm tracking-[0.3em] text-center focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/15 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-[15px] font-semibold text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create Account" : "Sign In"}
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
