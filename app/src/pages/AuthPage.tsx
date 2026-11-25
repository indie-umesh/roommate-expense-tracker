import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { SettingsModal } from "../components/SettingsModal";
import { BrandLogo } from "../components/BrandLogo";
import { MARKETING_HOMEPAGE_URL } from "../lib/config";
import {
  Lock,
  User,
  ArrowRight,
  Loader2,
  Sun,
  Moon,
  HelpCircle,
  KeyRound,
  CheckCircle2,
  X,
  Globe,
} from "lucide-react";

export const SECURITY_QUESTIONS = [
  "What is your flat / room number or city?",
  "What was your childhood nickname?",
  "What is your favorite food or restaurant?",
  "What was the name of your first school or college?",
];

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithPhonePin, signUpWithPhonePin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(() => {
    try {
      return localStorage.getItem("roommate_pending_invite");
    } catch {
      return null;
    }
  });

  // Forgot PIN State
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotQuestion, setForgotQuestion] = useState<string | null>(null);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

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
      if (!securityAnswer.trim()) {
        setError("Please enter a security answer to easily reset your PIN if forgotten");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithPhonePin(
          cleanPhone,
          pin,
          displayName.trim(),
          securityQuestion,
          securityAnswer.trim()
        );
      } else {
        await signInWithPhonePin(cleanPhone, pin);
      }

      // Check if user came via an invite link
      const pendingCode = localStorage.getItem("roommate_pending_invite");
      if (pendingCode) {
        try {
          const { data: joinedGroupId, error: joinErr } = await supabase.rpc("join_group", {
            p_invite_code: pendingCode.trim().toUpperCase(),
          });
          localStorage.removeItem("roommate_pending_invite");
          if (!joinErr && joinedGroupId) {
            navigate(`/group/${joinedGroupId}`, { replace: true });
            return;
          }
        } catch (joinEx) {
          console.error("Auto-join error:", joinEx);
          localStorage.removeItem("roommate_pending_invite");
        }
      }

      // Route directly into flat or setup
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

  // Forgot PIN Step 1: Look up Question
  async function handleLookupQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotMsg(null);
    const clean = forgotPhone.replace(/\D/g, "");
    if (clean.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setForgotLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_security_question", {
        p_phone: clean,
      });
      if (rpcErr) throw rpcErr;
      if (data && data.found) {
        setForgotQuestion(data.question);
      } else {
        setError(data?.message || "No security question found for this number.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to find security question");
    } finally {
      setForgotLoading(false);
    }
  }

  // Forgot PIN Step 2: Answer and Reset PIN
  async function handleResetPinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotMsg(null);
    const clean = forgotPhone.replace(/\D/g, "");
    if (!forgotAnswer.trim()) {
      setError("Please enter your security answer");
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setError("New PIN must be exactly 6 digits");
      return;
    }
    if (newPin !== confirmNewPin) {
      setError("PINs do not match");
      return;
    }
    setForgotLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("reset_pin_with_security_answer", {
        p_phone: clean,
        p_answer: forgotAnswer.trim(),
        p_new_pin: newPin,
      });
      if (rpcErr) throw rpcErr;
      if (data && data.success) {
        setForgotMsg(data.message);
        // Automatically sign in!
        await signInWithPhonePin(clean, newPin);
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
      } else {
        setError(data?.message || "Incorrect security answer.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to reset PIN");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 relative transition-colors duration-200">
      {/* Top Header Controls: Language & Theme */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="btn-surface px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          title={t("choose_language")}
        >
          <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>
            {currentLanguage?.flag} {currentLanguage?.name || "Language"}
          </span>
        </button>
        <button
          onClick={toggleTheme}
          className="btn-surface px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
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

      {/* Top Homepage Return Pill */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-3">
        <a
          href={MARKETING_HOMEPAGE_URL}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[12px] text-[var(--text-muted)] hover:text-[#00966d] dark:hover:text-[#00e599] transition"
        >
          <span>←</span>
          <span>Return to Homepage</span>
        </a>
      </div>

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <a
          href={MARKETING_HOMEPAGE_URL}
          className="inline-block transition-transform duration-200 hover:scale-105 mb-2 focus:outline-none"
          title="Return to Roommate Homepage"
        >
          <BrandLogo size={52} showText={false} />
        </a>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Roommate
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)] font-normal">
          {t("sign_in_desc")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card-clean p-6 sm:p-8">
          {pendingInvite && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Joining Flat:</span>
                <span className="font-mono font-extrabold tracking-wider bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30 text-[#00966d] dark:text-[#00e599]">
                  {pendingInvite}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem("roommate_pending_invite"); } catch {}
                  setPendingInvite(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[11px] underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Segmented Minimal Tabs */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl mb-6 border border-slate-200/80 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setShowForgotPin(false);
              }}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer ${
                !isSignUp && !showForgotPin
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t("sign_in_btn")}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setShowForgotPin(false);
              }}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer ${
                isSignUp && !showForgotPin
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t("sign_up_btn")}
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          {forgotMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-medium leading-relaxed">
              {forgotMsg}
            </div>
          )}

          {/* FORGOT PIN VIEW */}
          {showForgotPin ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    {t("reset_pin_title")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPin(false);
                    setForgotQuestion(null);
                    setError(null);
                  }}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!forgotQuestion ? (
                /* Step 1: Mobile Number */
                <form onSubmit={handleLookupQuestion} className="space-y-4">
                  <p className="text-xs text-[var(--text-muted)]">
                    {t("phone_label")}
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t("mobile_number")}
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
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(e.target.value)}
                        placeholder="9876543210"
                        className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-r-xl text-[var(--text-primary)] placeholder-slate-400 text-sm tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Answer & New PIN */
                <form onSubmit={handleResetPinSubmit} className="space-y-4">
                  <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/40 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {t("security_question_label")}:
                    </span>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {forgotQuestion}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t("security_answer_label")}
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      placeholder="Enter your security answer"
                      className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t("new_pin_label")}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="••••••"
                      className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] text-sm tracking-[0.3em] text-center focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t("confirm_pin_label")}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      placeholder="••••••"
                      className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[var(--text-primary)] text-sm tracking-[0.3em] text-center focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t("reset_pin_btn")}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* NORMAL SIGN IN / SIGN UP FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    {t("full_name")}
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
                  {t("mobile_number")}
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
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setForgotPhone(e.target.value);
                    }}
                    placeholder="9876543210"
                    className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-r-xl text-[var(--text-primary)] placeholder-slate-400 text-sm tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {t("pin_label")}
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPin(true);
                        setForgotPhone(phone);
                        setError(null);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {t("forgot_pin")}
                    </button>
                  )}
                </div>
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
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t("confirm_pin_label")}
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

                  {/* Security Question for Easy PIN Reset */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] font-semibold">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t("security_question_label")}</span>
                    </div>

                    <div>
                      <select
                        value={securityQuestion}
                        onChange={(e) => setSecurityQuestion(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {SECURITY_QUESTIONS.map((q) => (
                          <option key={q} value={q} className="dark:bg-slate-900">
                            {q}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        required
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        placeholder="Your Answer (e.g. 302, Indore, Maggi)"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 transition"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                        Used to easily reset your PIN if you ever forget it.
                      </span>
                    </div>
                  </div>
                </>
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
                    <span>{isSignUp ? t("sign_up_btn") : t("sign_in_btn")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Settings Modal (Language & Theme) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
