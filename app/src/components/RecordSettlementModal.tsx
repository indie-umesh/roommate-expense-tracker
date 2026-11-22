import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { rupeesToPaise, paiseToRupees } from "../lib/money";
import type { Member } from "../lib/types";
import { X, Check, Loader2, ArrowRight, ArrowLeftRight, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface RecordSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Member[];
  initialFromMemberId?: string;
  initialToMemberId?: string;
  initialAmountPaise?: bigint;
  initialNote?: string;
  contextTitle?: string;
  onSuccess?: () => void;
}

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
const QUICK_NOTES = [
  "GPay / UPI",
  "Cash diya",
  "Hisaab clear",
  "Galat bill adjust",
];

export const RecordSettlementModal: React.FC<RecordSettlementModalProps> = ({
  isOpen,
  onClose,
  groupId,
  members,
  initialFromMemberId,
  initialToMemberId,
  initialAmountPaise,
  initialNote,
  contextTitle,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const myMember = members.find((m) => m.user_id === user?.id);
  const otherMembers = members.filter((m) => m.id !== myMember?.id);

  const [fromMemberId, setFromMemberId] = useState<string>("");
  const [toMemberId, setToMemberId] = useState<string>("");
  const [amountRupees, setAmountRupees] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [settledOn, setSettledOn] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFromMemberId(initialFromMemberId || myMember?.id || members[0]?.id || "");
      setToMemberId(
        initialToMemberId ||
          (myMember ? otherMembers[0]?.id || "" : members[1]?.id || "")
      );
      if (initialAmountPaise && initialAmountPaise > 0n) {
        setAmountRupees(paiseToRupees(initialAmountPaise).toString());
      } else {
        setAmountRupees("");
      }
      setNote(initialNote || "");
      setSettledOn(new Date().toISOString().split("T")[0]);
    }
  }, [
    isOpen,
    initialFromMemberId,
    initialToMemberId,
    initialAmountPaise,
    initialNote,
  ]);

  function handleSelectFrom(id: string) {
    setFromMemberId(id);
    if (toMemberId === id) {
      const alt = members.find((m) => m.id !== id);
      if (alt) setToMemberId(alt.id);
    }
  }

  function handleSelectTo(id: string) {
    setToMemberId(id);
    if (fromMemberId === id) {
      const alt = members.find((m) => m.id !== id);
      if (alt) setFromMemberId(alt.id);
    }
  }

  function addQuickAmount(amount: number) {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + amount).toString());
  }

  const recordSettlementMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amountRupees);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Kripya sahi amount dalein (jaise ₹100)");
      }
      if (!fromMemberId) {
        throw new Error("Select karein kisne paise diye");
      }
      if (!toMemberId) {
        throw new Error("Select karein kisko paise mile");
      }
      if (fromMemberId === toMemberId) {
        throw new Error("Dene wala aur lene wala same roommate nahi ho sakta");
      }

      const paise = rupeesToPaise(amountRupees);

      const { error } = await supabase.from("settlements").insert({
        group_id: groupId,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount_paise: paise.toString(),
        settled_on: settledOn,
        note: note.trim() || null,
        created_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      confetti({ particleCount: 70, spread: 60 });
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || "Payment record karne me error aaya");
    },
  });

  const parsedAmount = parseFloat(amountRupees) || 0;
  const isFormValid =
    parsedAmount > 0 &&
    fromMemberId &&
    toMemberId &&
    fromMemberId !== toMemberId &&
    !recordSettlementMutation.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Centered Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="relative bg-white dark:bg-[#111827] text-[var(--text-primary)] w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto border border-slate-200/90 dark:border-white/10 my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <ArrowLeftRight className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-primary)] tracking-tight">
                    {t("record_payment")}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-normal">
                    {t("optimal_settle_desc")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {contextTitle && (
              <div className="mt-3 p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/40 rounded-xl flex items-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                <Receipt className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="line-clamp-1">{contextTitle}</span>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isFormValid) recordSettlementMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              {/* Who pays whom */}
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 rounded-xl">
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1.5">
                    1. {t("who_paid_settle")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const isSelected = fromMemberId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectFrom(m.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-rose-500 text-white shadow-xs"
                              : "btn-surface text-[var(--text-muted)]"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          <span>{m.display_name}</span>
                          {m.id === myMember?.id && (
                            <span className="text-[10px] opacity-80">({t("you")})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-center my-1">
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                    2. {t("who_received_settle")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const isSelected = toMemberId === m.id;
                      const isPayer = fromMemberId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isPayer}
                          onClick={() => handleSelectTo(m.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isPayer
                              ? "opacity-30 cursor-not-allowed btn-surface"
                              : isSelected
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "btn-surface text-[var(--text-muted)]"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          <span>{m.display_name}</span>
                          {m.id === myMember?.id && (
                            <span className="text-[10px] opacity-80">({t("you")})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {t("amount_paid")}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[var(--text-muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-3xl font-extrabold text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Quick Add Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium mr-1">
                    Quick add:
                  </span>
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => addQuickAmount(amt)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium btn-surface text-[var(--text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Note Input */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {t("payment_note")}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("payment_note_placeholder")}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500 transition"
                />

                {/* Quick Note Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_NOTES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNote(preset)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-normal bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[var(--text-muted)] transition cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {t("date")}
                </label>
                <input
                  type="date"
                  value={settledOn}
                  onChange={(e) => setSettledOn(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {recordSettlementMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t("saving_payment")}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {t("save_payment_btn")} {parsedAmount > 0 ? `(₹${parsedAmount})` : ""}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
