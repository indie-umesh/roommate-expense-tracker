import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import type { Member, Expense, Settlement } from "../lib/types";
import { ChevronLeft, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

export const SettleUpPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [checkpointNote, setCheckpointNote] = useState("");
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
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
  const balances = calculateBalances(
    members.map((m) => m.id),
    expenses,
    settlements
  );
  const simplifiedTransfers = simplifyDebts(balances);

  // Record Settlement Mutation
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
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to record payment");
    },
  });

  // Create Checkpoint Mutation
  const createCheckpointMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from("checkpoints").insert({
        group_id: groupId,
        note: note.trim() || "Month settled checkpoint",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowCheckpointInput(false);
      setCheckpointNote("");
      navigate(`/group/${groupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create checkpoint");
    },
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-4 py-4 bg-slate-800/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white">Settle Up</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="p-4 bg-slate-800 border border-slate-700/80 rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-1">
            Minimal Payments to Settle
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Optimized minimal transfers required to balance all accounts to zero.
          </p>

          {simplifiedTransfers.length === 0 ? (
            <div className="text-center py-6 text-emerald-400 text-sm font-medium">
              ✓ Everything is already settled up!
            </div>
          ) : (
            <div className="space-y-3">
              {simplifiedTransfers.map((t, idx) => {
                const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-bold text-rose-300">{fromName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-bold text-emerald-300">{toName}</span>
                      </div>
                      <span className="text-base font-extrabold text-white mt-1 block">
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
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as Paid
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkpoint Section */}
        <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Create Checkpoint</h3>
              <p className="text-xs text-slate-400">
                Mark that everything has been settled up to this date.
              </p>
            </div>
            {!showCheckpointInput && (
              <button
                onClick={() => setShowCheckpointInput(true)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-lg text-white"
              >
                Add
              </button>
            )}
          </div>

          {showCheckpointInput && (
            <div className="space-y-2 pt-2 border-t border-slate-700/50">
              <input
                type="text"
                placeholder="e.g. Settled up for November 2026"
                value={checkpointNote}
                onChange={(e) => setCheckpointNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckpointInput(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createCheckpointMutation.isPending}
                  onClick={() => createCheckpointMutation.mutate(checkpointNote)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-lg text-white flex items-center gap-1.5"
                >
                  {createCheckpointMutation.isPending && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  Save Checkpoint
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
