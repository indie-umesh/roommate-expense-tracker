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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col">
      <header className="px-4 py-3.5 bg-white/80 backdrop-blur-md border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-[#86868b] hover:text-[#1d1d1f]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-base text-[#1d1d1f] tracking-tight">Settle Up</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="p-5 bg-white border border-[#e5e5e7] rounded-[22px] shadow-sm">
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">
            Minimal Payments
          </h2>
          <p className="text-xs text-[#86868b] mb-4">
            Optimized minimal transactions required to balance all roommates to zero.
          </p>

          {simplifiedTransfers.length === 0 ? (
            <div className="text-center py-8 text-[#00875a] text-sm font-semibold">
              ✓ All accounts are balanced!
            </div>
          ) : (
            <div className="space-y-3">
              {simplifiedTransfers.map((t, idx) => {
                const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                return (
                  <div
                    key={idx}
                    className="p-4 bg-[#fbfbfd] border border-[#e5e5e7] rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
                        <span className="font-semibold text-[#1d1d1f]">{fromName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#86868b]" />
                        <span className="font-semibold text-[#0066cc]">{toName}</span>
                      </div>
                      <span className="text-lg font-bold text-[#1d1d1f] mt-1 block tracking-tight">
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
                      className="px-4 py-2 rounded-full bg-[#00875a] hover:bg-[#00704a] active:scale-95 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Paid
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkpoint Section */}
        <div className="p-5 bg-white border border-[#e5e5e7] rounded-[22px] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Monthly Checkpoint</h3>
              <p className="text-xs text-[#86868b]">
                Record a marker that everything has been settled up to this date.
              </p>
            </div>
            {!showCheckpointInput && (
              <button
                onClick={() => setShowCheckpointInput(true)}
                className="px-4 py-1.5 bg-[#f5f5f7] hover:bg-[#e5e5e7] text-xs font-semibold rounded-full text-[#1d1d1f] transition"
              >
                Add
              </button>
            )}
          </div>

          {showCheckpointInput && (
            <div className="space-y-2.5 pt-3 border-t border-[#f0f0f0]">
              <input
                type="text"
                placeholder="e.g. Settled up for November 2026"
                value={checkpointNote}
                onChange={(e) => setCheckpointNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0066cc]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckpointInput(false)}
                  className="px-3.5 py-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createCheckpointMutation.isPending}
                  onClick={() => createCheckpointMutation.mutate(checkpointNote)}
                  className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0071e3] text-xs font-semibold rounded-full text-white flex items-center gap-1.5"
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
