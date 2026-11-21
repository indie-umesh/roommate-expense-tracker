import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { formatINR } from "../lib/money";
import type { Member, Expense } from "../lib/types";
import { ChevronLeft, Trash2, Loader2 } from "lucide-react";

export const ExpenseDetailPage: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Soft Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      navigate(`/group/${groupId}`);
    },
  });

  if (isLoading || !expense) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">
        Loading expense...
      </div>
    );
  }

  const payerName = memberMap.get(expense.paid_by_member_id)?.display_name || "Unknown";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-4 py-4 bg-slate-800/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white">Expense Details</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {/* Main Card */}
        <div className="p-5 bg-slate-800 border border-slate-700/80 rounded-2xl space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{expense.details}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Paid by <span className="font-semibold text-slate-200">{payerName}</span> on{" "}
                {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white block">
                {formatINR(expense.amount_paise)}
              </span>
              {expense.updated_at > expense.created_at && (
                <span className="text-[10px] text-amber-400 font-medium">Edited</span>
              )}
            </div>
          </div>
        </div>

        {/* Splits breakdown */}
        <div className="p-4 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Split Breakdown
          </h3>
          <div className="space-y-2">
            {expense.splits?.map((split) => {
              const name = memberMap.get(split.member_id)?.display_name || "Roommate";
              return (
                <div
                  key={split.member_id}
                  className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0 text-sm"
                >
                  <span className="text-slate-300">{name}</span>
                  <span className="font-semibold text-white">
                    {formatINR(split.share_paise)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete action */}
        <div className="pt-6">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 text-sm font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete Expense
            </button>
          ) : (
            <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-2xl space-y-3 text-center">
              <p className="text-xs text-rose-200 font-medium">
                Are you sure? This will remove this expense from group balances.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 bg-slate-800 rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs text-white font-semibold flex items-center gap-1.5"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
