import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { ArrowRight, Loader2, AlertCircle, Users, CheckCircle2 } from "lucide-react";

export const JoinGroupPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = (inviteCode || "").trim().toUpperCase();

  useEffect(() => {
    if (!cleanCode) {
      setError("No invite code provided");
      return;
    }

    // Save to localStorage so if the user needs to log in, it auto-joins after login
    localStorage.setItem("roommate_pending_invite", cleanCode);

    if (authLoading) return;

    if (user) {
      // User is already logged in, automatically join the flat!
      handleAutoJoin();
    }
  }, [cleanCode, user, authLoading]);

  async function handleAutoJoin() {
    if (!cleanCode) return;
    setJoining(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("join_group", {
        p_invite_code: cleanCode,
      });

      if (error) throw error;

      // Clear pending code on success
      localStorage.removeItem("roommate_pending_invite");

      // Redirect directly to the joined group
      const targetGroupId = data as string;
      navigate(`/group/${targetGroupId}`, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid invite code or unable to join this flat.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-md card-clean p-6 sm:p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <BrandLogo size={32} />
        </div>

        {joining || authLoading ? (
          <div className="space-y-3 py-6">
            <Loader2 className="w-8 h-8 text-[#00966d] animate-spin mx-auto" />
            <h2 className="text-base font-bold">Joining Flat...</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono">Code: {cleanCode}</p>
          </div>
        ) : error ? (
          <div className="space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">Failed to Join Flat</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate("/setup")}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-semibold transition"
              >
                Go to My Flats
              </button>
              <button
                type="button"
                onClick={handleAutoJoin}
                className="w-full py-2.5 rounded-xl bg-[#00966d] hover:bg-[#00ab7d] text-white text-xs font-semibold transition"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : !user ? (
          <div className="space-y-5 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00966d] dark:text-[#00e599] flex items-center justify-center mx-auto shadow-sm">
              <Users className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#00966d] dark:text-[#00e599]">
                Flat Invitation
              </span>
              <h2 className="text-xl font-bold tracking-tight">You're Invited to Join!</h2>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                Your flatmate invited you to track shared bills and split expenses together.
              </p>
            </div>

            <div className="py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 inline-flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Invite Code:</span>
              <span className="font-mono font-extrabold text-sm tracking-wider text-[#00966d] dark:text-[#00e599]">
                {cleanCode}
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-3 px-4 rounded-xl bg-[#00966d] hover:bg-[#00ab7d] text-white text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>Continue with Mobile & PIN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              Zero OTP wait · 10-second setup · 100% Free Forever
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-6">
            <CheckCircle2 className="w-8 h-8 text-[#00966d] mx-auto" />
            <h2 className="text-base font-bold">Ready to Join Flat</h2>
            <button
              type="button"
              onClick={handleAutoJoin}
              className="w-full py-2.5 rounded-xl bg-[#00966d] hover:bg-[#00ab7d] text-white text-xs font-semibold transition"
            >
              Join Flat Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
