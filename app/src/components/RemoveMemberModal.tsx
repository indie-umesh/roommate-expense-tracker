import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { formatINR } from "../lib/money";
import { useLanguage } from "../context/LanguageContext";
import { localizeName } from "../lib/transliterate";
import type { Member, Expense } from "../lib/types";
import type { MemberBalance } from "../lib/balances";
import {
  AlertTriangle,
  Lock,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Receipt,
  X,
} from "lucide-react";

interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  groupId: string;
  balances: MemberBalance[];
  expenses: Expense[];
  onGoToSettleUp: () => void;
}

export const RemoveMemberModal: React.FC<RemoveMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  groupId,
  balances,
  expenses,
  onGoToSettleUp,
}) => {
  const queryClient = useQueryClient();
  const { t, currentLanguage } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.rpc("remove_member", {
        p_member_id: memberId,
        p_force: false,
      });
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || "Cannot remove roommate");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      setErrorMessage(null);
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || "Failed to remove roommate");
    },
  });

  if (!isOpen || !member) return null;

  // Calculate member status
  const bal = balances.find((b) => b.memberId === member.id)?.netPaise ?? 0n;
  const memberExpensesPaid = expenses.filter((e) => e.paid_by_member_id === member.id);
  const memberSplits = expenses.filter((e) =>
    e.splits?.some((s) => s.member_id === member.id)
  );
  const hasBills = memberExpensesPaid.length > 0 || memberSplits.length > 0;
  const isLocked = bal !== 0n || hasBills;

  function handleClose() {
    setErrorMessage(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#111827] text-[var(--text-primary)] max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden space-y-0">
        {/* Header */}
        <div className={`p-5 flex items-start justify-between border-b ${
          isLocked
            ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30"
            : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-100 dark:border-white/10"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isLocked
                ? "bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400"
                : "bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400"
            }`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">
                {isLocked
                  ? t("cannot_remove_title", { name: localizeName(member.display_name, currentLanguage.code) })
                  : t("remove_title", { name: localizeName(member.display_name, currentLanguage.code) })}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                {isLocked
                  ? t("account_not_settled")
                  : member.user_id ? t("active_registered") : t("unclaimed_roommate")}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLocked ? (
            <div className="space-y-3.5">
              {/* Prominent Warning Callout */}
              <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t("removal_blocked")}</span>
                </div>
                <p className="text-xs text-rose-800/90 dark:text-rose-200/90 leading-relaxed font-normal">
                  {t("removal_blocked_desc")}
                </p>
              </div>

              {/* Exact Financial Status Breakdown */}
              <div className="p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  {t("pending_dues_status")}
                </span>

                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-[var(--text-muted)]">{t("net_balance")}:</span>
                  <span className="font-bold">
                    {bal > 0n ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {t("flat_owes_them", { amount: formatINR(bal) })}
                      </span>
                    ) : bal < 0n ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        {t("owes_flat", { amount: formatINR(-bal) })}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">{t("zero_debt")}</span>
                    )}
                  </span>
                </div>

                {memberExpensesPaid.length > 0 && (
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-white/5">
                    <span className="text-[var(--text-muted)] flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{t("bills_paid")}</span>
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {memberExpensesPaid.length} active {memberExpensesPaid.length === 1 ? "bill" : "bills"}
                    </span>
                  </div>
                )}

                {memberSplits.length > 0 && (
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-[var(--text-muted)]">{t("split_shares")}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {memberSplits.length} active {memberSplits.length === 1 ? "bill" : "bills"}
                    </span>
                  </div>
                )}
              </div>

              {/* Next Steps Guidance */}
              <div className="text-[11px] text-[var(--text-muted)] leading-relaxed space-y-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 p-3 rounded-xl">
                <span className="font-bold text-amber-800 dark:text-amber-300 block">💡 {t("how_to_remove")}</span>
                <p className="text-amber-900/80 dark:text-amber-200/80">
                  {t("how_to_remove_step1")}<br />
                  {t("how_to_remove_step2")}<br />
                  {t("how_to_remove_step3")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-bold block">{t("settled_clean")}</span>
                  <p className="mt-0.5 leading-relaxed text-emerald-700 dark:text-emerald-300/90 font-normal">
                    {t("settled_clean_desc")}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {t("confirm_remove_prompt", { name: localizeName(member.display_name, currentLanguage.code) })}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            {isLocked ? t("close_understood") : t("cancel")}
          </button>

          {isLocked ? (
            <button
              type="button"
              onClick={() => {
                handleClose();
                onGoToSettleUp();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <span>{t("go_to_settle_up")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => deleteMemberMutation.mutate(member.id)}
              disabled={deleteMemberMutation.isPending}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {deleteMemberMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t("yes_remove")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
