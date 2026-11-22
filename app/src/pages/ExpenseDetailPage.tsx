import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { formatINR, paiseToRupees, rupeesToPaise } from "../lib/money";
import { formatDateLocale } from "../lib/i18n";
import type { Member, Expense } from "../lib/types";
import { RecordSettlementModal } from "../components/RecordSettlementModal";
import {
  ChevronLeft,
  Edit2,
  Check,
  ShieldCheck,
  CreditCard,
  Ban,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const ExpenseDetailPage: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentParams, setPaymentParams] = useState<{
    fromMemberId?: string;
    toMemberId?: string;
    amountPaise?: bigint;
    initialNote?: string;
    contextTitle?: string;
  }>({});

  // Edit form state
  const [editAmount, setEditAmount] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editSpentOn, setEditSpentOn] = useState("");
  const [editPaidBy, setEditPaidBy] = useState("");
  const [editParticipants, setEditParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch expense with splits
  const { data: expense, isLoading } = useQuery<Expense>({
    queryKey: ["expense-detail", expenseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          splits:expense_splits(*)
        `)
        .eq("id", expenseId)
        .single();
      if (error) throw error;
      return {
        ...data,
        amount_paise: BigInt(data.amount_paise),
        splits: (data.splits || []).map((s: any) => ({
          ...s,
          share_paise: BigInt(s.share_paise),
        })),
      };
    },
    enabled: !!expenseId,
  });

  // Fetch group members
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", groupId);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  useEffect(() => {
    if (expense) {
      setEditAmount(paiseToRupees(expense.amount_paise).toString());
      setEditDetails(expense.details);
      setEditSpentOn(expense.spent_on);
      setEditPaidBy(expense.paid_by_member_id);
      setEditParticipants(expense.splits?.map((s) => s.member_id) || []);
    }
  }, [expense]);

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const myMember = members.find((m) => m.user_id === user?.id);
  const payerMember = expense ? memberMap.get(expense.paid_by_member_id) : undefined;
  const payerName = payerMember
    ? payerMember.user_id === user?.id
      ? `${payerMember.display_name} (${t("you")})`
      : payerMember.display_name
    : t("roommates");

  // Only the person who paid this bill (or admin) can edit details/corrections
  const canEdit = expense && myMember && (
    expense.paid_by_member_id === myMember.id || myMember.role === "admin"
  );

  // Update Expense Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editAmount || parseFloat(editAmount) <= 0) {
        throw new Error("Invalid amount");
      }
      if (!editDetails.trim()) {
        throw new Error("Please enter details");
      }
      if (!editPaidBy) {
        throw new Error("Select who paid");
      }
      if (editParticipants.length === 0) {
        throw new Error("Select at least one participant");
      }

      const paise = rupeesToPaise(editAmount);

      const { error } = await supabase.rpc("update_expense", {
        p_expense_id: expenseId,
        p_paid_by_member_id: editPaidBy,
        p_amount_paise: paise.toString(),
        p_details: editDetails.trim(),
        p_spent_on: editSpentOn,
        p_participant_member_ids: editParticipants,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-detail", expenseId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      setIsEditing(false);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to update expense");
    },
  });

  // Cancel Bill Mutation (Audit-logged soft cancellation, zeroes out debts)
  const cancelBillMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      navigate(`/group/${groupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to cancel bill");
      setShowCancelConfirm(false);
    },
  });

  function toggleParticipant(memberId: string) {
    if (editParticipants.includes(memberId)) {
      if (editParticipants.length > 1) {
        setEditParticipants(editParticipants.filter((id) => id !== memberId));
      }
    } else {
      setEditParticipants([...editParticipants, memberId]);
    }
  }

  if (isLoading || !expense) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] text-sm font-medium">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col pb-12 transition-colors duration-200">
      <header className="h-16 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-20 transition-all">
        <div className="max-w-3xl h-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">{t("expense_details")}</h1>
          {canEdit ? (
            !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-surface h-9 px-3 rounded-xl font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t("edit")}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="h-9 px-3 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer flex items-center"
              >
                {t("cancel")}
              </button>
            )
          ) : (
            <div className="w-9" />
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-md md:max-w-2xl lg:max-w-3xl w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {isEditing ? (
          <div className="card-clean p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {t("amount_inr")}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-2xl font-bold text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {t("what_for")}
              </label>
              <input
                type="text"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {t("who_paid")}
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditPaidBy(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      editPaidBy === m.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "btn-surface text-[var(--text-muted)]"
                    }`}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {t("split_participants")}
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isChecked = editParticipants.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition cursor-pointer ${
                        isChecked
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 dark:border-white/10 text-[var(--text-muted)] hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          isChecked ? "bg-indigo-600 text-white" : "border border-slate-300 dark:border-white/20"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span>{m.display_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{t("cancel_bill")}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="px-5 py-2 rounded-lg btn-primary text-xs font-medium shadow-xs disabled:opacity-50"
                >
                  {updateMutation.isPending ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Bill Overview Card */}
            <div className="card-clean p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {expense.details}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-normal">
                    {t("logged_on")}{" "}
                    {formatDateLocale(expense.spent_on, currentLanguage.code, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {formatINR(expense.amount_paise)}
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {t("paid_by")} <strong className="text-[var(--text-primary)]">{payerName}</strong>
                  </p>
                </div>
              </div>

              {/* Split Breakdown */}
              <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  {t("split_among_roommates", { count: expense.splits?.length || 0 })}
                </span>
                <div className="space-y-2">
                  {expense.splits?.map((split) => {
                    const m = memberMap.get(split.member_id);
                    const isPayer = split.member_id === expense.paid_by_member_id;
                    const isMe = split.member_id === myMember?.id;

                    return (
                      <div
                        key={split.member_id}
                        className="flex items-center justify-between text-xs py-2 px-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-primary)] font-medium">
                            {m?.display_name || "Roommate"}
                          </span>
                          {isMe && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">({t("you")})</span>
                          )}
                          {isPayer && (
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-semibold">
                              {t("paid_by")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-primary)]">
                            {formatINR(split.share_paise)}
                          </span>
                          {!isPayer && (
                            <button
                              onClick={() => {
                                setPaymentParams({
                                  fromMemberId: split.member_id,
                                  toMemberId: expense.paid_by_member_id,
                                  amountPaise: split.share_paise,
                                  initialNote: `Paid for: ${expense.details}`,
                                  contextTitle: `Pay ${m?.display_name || "Roommate"}'s share for ${expense.details}`,
                                });
                                setShowPaymentModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-[0.98]"
                            >
                              <span>{t("mark_as_paid")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Settle / Pay Bill Action Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t("optimal_settle_desc")}:
                  </span>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{t("cancel_bill")}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPaymentParams({
                          fromMemberId:
                            myMember?.id !== expense.paid_by_member_id
                              ? myMember?.id
                              : undefined,
                          toMemberId: expense.paid_by_member_id,
                          amountPaise: expense.amount_paise,
                          initialNote: `Paid for: ${expense.details}`,
                          contextTitle: `Pay for: ${expense.details}`,
                        });
                        setShowPaymentModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{t("record_payment_for_bill")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Permanent & Immutable Ledger Guarantee (Beimaani-Proof) */}
            <div className="card-clean p-4 bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                  <span>{t("transparent_ledger")}</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 rounded-full font-bold">
                    100%
                  </span>
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {t("transparent_ledger_desc")}
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Record Payment Modal */}
      <RecordSettlementModal
        groupId={groupId!}
        members={members}
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        initialFromMemberId={paymentParams.fromMemberId}
        initialToMemberId={paymentParams.toMemberId}
        initialAmountPaise={paymentParams.amountPaise}
        initialNote={paymentParams.initialNote}
        contextTitle={paymentParams.contextTitle}
      />

      {/* Cancel Bill Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111827] text-[var(--text-primary)] max-w-sm w-full p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t("cancel_bill_prompt")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                {t("cancel_bill_desc")}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {t("keep_bill")}
              </button>
              <button
                type="button"
                onClick={() => cancelBillMutation.mutate()}
                disabled={cancelBillMutation.isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {cancelBillMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("cancelling")}</span>
                  </>
                ) : (
                  <span>{t("yes_cancel_bill")}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
