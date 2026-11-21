import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import type { Member, Expense, Settlement } from "../lib/types";
import { ChevronLeft, CheckCircle2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

export const SettleUpPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

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
        .is("deleted_at", null);
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
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col">
      <header className="px-4 py-3.5 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white tracking-tight">Settle Up</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="p-6 bg-[#121826] border border-white/10 rounded-[28px] shadow-xl">
          <h2 className="text-base font-black text-white mb-1">
            Minimal Payments
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Optimized minimal payments required to balance all roommates to zero.
          </p>

          {simplifiedTransfers.length === 0 ? (
            <div className="text-center py-10 text-emerald-400 text-sm font-black">
              ✓ All accounts are balanced! Zero debt.
            </div>
          ) : (
            <div className="space-y-3">
              {simplifiedTransfers.map((t, idx) => {
                const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                return (
                  <div
                    key={idx}
                    className="p-4 bg-[#182238] border border-white/10 rounded-2xl flex items-center justify-between shadow-md"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="font-bold text-rose-400">{fromName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-bold text-emerald-400">{toName}</span>
                      </div>
                      <span className="text-2xl font-black text-white mt-1 block tracking-tight">
                        {formatINR(t.amountPaise)}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        recordSettlementMutation.mutate({
                          fromMemberId: t.fromMemberId,
                          toMemberId: t.toMemberId,
                          amountPaise: t.amountPaise,
                        })
                      }
                      disabled={recordSettlementMutation.isPending}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-full shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Paid
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
