import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { formatINR, paiseToRupees, rupeesToPaise } from "../lib/money";
import type { Member, Expense } from "../lib/types";
import { ChevronLeft, Trash2, Edit2, Loader2, Check } from "lucide-react";

export const ExpenseDetailPage: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      navigate(`/group/${groupId}`);
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
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-sm">
        Loading expense...
      </div>
    );
  }

  const payerName = memberMap.get(expense.paid_by_member_id)?.display_name || "Unknown";

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col">
      <header className="px-4 py-3.5 bg-white/80 backdrop-blur-md border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-[#86868b] hover:text-[#1d1d1f]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-base text-[#1d1d1f] tracking-tight">Expense Details</h1>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-[#0066cc] font-medium text-xs flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 text-[#86868b] text-xs"
          >
            Cancel
          </button>
        )}
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {isEditing ? (
          <div className="bg-white p-6 rounded-[22px] border border-[#e5e5e7] space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-lg font-bold text-[#1d1d1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                Details
              </label>
              <input
                type="text"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-sm text-[#1d1d1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                Paid by
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditPaidBy(m.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                      editPaidBy === m.id
                        ? "bg-[#0066cc] text-white"
                        : "bg-[#f5f5f7] text-[#1d1d1f]"
                    }`}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                Split Among
              </label>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const isChecked = editParticipants.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
                        isChecked
                          ? "bg-white border-[#0066cc] text-[#1d1d1f]"
                          : "bg-[#fbfbfd] border-[#e5e5e7] text-[#86868b]"
                      }`}
                    >
                      <span className="truncate">{m.display_name}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                value={editSpentOn}
                onChange={(e) => setEditSpentOn(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f]"
              />
            </div>

            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full py-3 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold text-sm shadow-sm transition disabled:opacity-50"
            >
              {updateMutation.isPending ? "Updating..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <>
            {/* Main Card */}
            <div className="p-6 bg-white border border-[#e5e5e7] rounded-[22px] space-y-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#1d1d1f] tracking-tight">{expense.details}</h2>
                  <p className="text-xs text-[#86868b] mt-1">
                    Paid by <span className="font-semibold text-[#1d1d1f]">{payerName}</span> on{" "}
                    {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#1d1d1f] block tracking-tight">
                    {formatINR(expense.amount_paise)}
                  </span>
                  {expense.updated_at > expense.created_at && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                      Edited
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Splits breakdown */}
            <div className="p-5 bg-white border border-[#e5e5e7] rounded-[22px] space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                Split Breakdown
              </h3>
              <div className="space-y-2.5">
                {expense.splits?.map((split) => {
                  const name = memberMap.get(split.member_id)?.display_name || "Roommate";
                  return (
                    <div
                      key={split.member_id}
                      className="flex items-center justify-between py-1.5 border-b border-[#f0f0f0] last:border-0 text-sm"
                    >
                      <span className="text-[#1d1d1f]">{name}</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {formatINR(split.share_paise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delete action */}
            <div className="pt-4">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full text-rose-600 border border-rose-200 hover:bg-rose-50 text-sm font-semibold transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Expense
                </button>
              ) : (
                <div className="p-5 bg-white border border-rose-200 rounded-[22px] space-y-3 text-center shadow-sm">
                  <p className="text-xs text-rose-700 font-medium">
                    Are you sure? This will remove this expense from group balances.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-5 py-2 bg-[#f5f5f7] hover:bg-[#e5e5e7] rounded-full text-xs text-[#1d1d1f] font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-xs text-white font-semibold flex items-center gap-1.5 transition"
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
          </>
        )}
      </main>
    </div>
  );
};
