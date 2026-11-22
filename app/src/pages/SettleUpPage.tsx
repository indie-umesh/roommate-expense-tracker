import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import type { Member, Expense, Settlement } from "../lib/types";
import { RecordSettlementModal } from "../components/RecordSettlementModal";
import {
  ChevronLeft,
  CheckCircle2,
  ArrowRight,
  Plus,
  History,
} from "lucide-react";
import confetti from "canvas-confetti";

export const SettleUpPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [showRecordSettlementModal, setShowRecordSettlementModal] = useState(false);
  const [settlementModalInitial, setSettlementModalInitial] = useState<{
    fromMemberId?: string;
    toMemberId?: string;
    amountPaise?: bigint;
  }>({});

  // Fetch members
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

  // Fetch active expenses
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["group-expenses", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`*, splits:expense_splits(*)`)
        .eq("group_id", groupId)
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []).map((exp: any) => ({
        ...exp,
        amount_paise: BigInt(exp.amount_paise),
        splits: (exp.splits || []).map((s: any) => ({
          ...s,
          share_paise: BigInt(s.share_paise),
        })),
      }));
    },
    enabled: !!groupId,
  });

  // Fetch active settlements
  const { data: settlements = [] } = useQuery<Settlement[]>({
    queryKey: ["group-settlements", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("group_id", groupId)
        .order("settled_on", { ascending: false });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        amount_paise: BigInt(s.amount_paise),
      }));
    },
    enabled: !!groupId,
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const memberIds = members.map((m) => m.id);
  const balances = calculateBalances(memberIds, expenses, settlements);
  const simplifiedTransfers = simplifyDebts(balances);

  // Settle Mutation
  const recordSettlementMutation = useMutation({
    mutationFn: async ({
      fromMemberId,
      toMemberId,
      amountPaise,
    }: {
      fromMemberId: string;
      toMemberId: string;
      amountPaise: bigint;
    }) => {
      const { error } = await supabase.from("settlements").insert({
        group_id: groupId,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount_paise: amountPaise.toString(),
        settled_on: new Date().toISOString().split("T")[0],
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      confetti({ particleCount: 70, spread: 60 });
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to record settlement");
    },
  });

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col transition-colors duration-200 pb-12">
      <header className="h-16 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 flex items-center sticky top-0 z-10 transition-all">
        <div className="max-w-2xl w-full h-full mx-auto px-4 flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">Settle Up</h1>
          <button
            onClick={() => {
              setSettlementModalInitial({});
              setShowRecordSettlementModal(true);
            }}
            className="btn-surface h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Custom</span> Settle
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto space-y-5">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Minimal Transfers Card */}
        <div className="card-clean p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Minimal Transfers
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Minimal payments needed so every roommate ends at ₹0 balance.
              </p>
            </div>
            <button
              onClick={() => {
                setSettlementModalInitial({});
                setShowRecordSettlementModal(true);
              }}
              className="btn-primary py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Reimbursement</span>
            </button>
          </div>

          {simplifiedTransfers.length === 0 ? (
            <div className="text-center py-10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              All balances are completely settled! Zero debt.
            </div>
          ) : (
            <div className="space-y-3">
              {simplifiedTransfers.map((t, idx) => {
                const fromMember = memberMap.get(t.fromMemberId);
                const toMember = memberMap.get(t.toMemberId);

                return (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-primary)]">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {fromMember?.display_name || "Someone"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {toMember?.display_name || "Someone"}
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
                        {formatINR(t.amountPaise)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSettlementModalInitial({
                            fromMemberId: t.fromMemberId,
                            toMemberId: t.toMemberId,
                            amountPaise: t.amountPaise,
                          });
                          setShowRecordSettlementModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                      >
                        Adjust / Note
                      </button>
                      <button
                        onClick={() =>
                          recordSettlementMutation.mutate({
                            fromMemberId: t.fromMemberId,
                            toMemberId: t.toMemberId,
                            amountPaise: t.amountPaise,
                          })
                        }
                        disabled={recordSettlementMutation.isPending}
                        className="px-4 py-2 btn-amber text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Settled</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settlement & Reimbursement History */}
        <div className="card-clean p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Settlement & Reimbursement History ({settlements.length})
              </h3>
            </div>
          </div>

          {settlements.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--text-muted)]">
              No settlements or reimbursements recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {settlements.map((s) => {
                const from = memberMap.get(s.from_member_id);
                const to = memberMap.get(s.to_member_id);
                return (
                  <div
                    key={s.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                        <span className="font-semibold text-rose-500 dark:text-rose-400">
                          {from?.display_name || "Roommate"}
                        </span>
                        <span className="text-[var(--text-muted)]">paid</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {to?.display_name || "Roommate"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {new Date(s.settled_on).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {s.note && (
                          <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium border border-indigo-200/50 dark:border-indigo-800/40">
                            💬 {s.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatINR(s.amount_paise)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Record Settlement / Reimbursement Modal */}
      <RecordSettlementModal
        groupId={groupId!}
        members={members}
        isOpen={showRecordSettlementModal}
        onClose={() => setShowRecordSettlementModal(false)}
        initialFromMemberId={settlementModalInitial.fromMemberId}
        initialToMemberId={settlementModalInitial.toMemberId}
        initialAmountPaise={settlementModalInitial.amountPaise}
      />
    </div>
  );
};
