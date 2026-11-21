import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR, paiseToRupees, rupeesToPaise } from "../lib/money";
import type { Member, Expense } from "../lib/types";
import { ChevronLeft, Trash2, Edit2, Loader2, Check, ShieldAlert, AlertTriangle } from "lucide-react";

export const ExpenseDetailPage: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("Duplicate entry");
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
  const myMember = members.find((m) => m.user_id === user?.id);
  const payerName = expense ? memberMap.get(expense.paid_by_member_id)?.display_name || "Unknown" : "Unknown";

  // Permission Check: Only the payer or admin can delete to prevent disputes
  const canDelete = expense && myMember && (
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

  // Soft Delete Mutation with Dispute Prevention
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
      queryClient.invalidateQueries({ queryKey: ["group-deleted-expenses", groupId] });
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
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400 text-sm">
        Loading bill details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col pb-12">
      <header className="px-4 md:px-8 py-4 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-base text-white tracking-tight">Expense Details</h1>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-full font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-md md:max-w-2xl lg:max-w-3xl w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {isEditing ? (
          <div className="bg-[#121826] p-6 rounded-[26px] border border-white/10 space-y-4 shadow-xl">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Amount (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full px-4 py-3 bg-[#182238] border border-white/10 rounded-xl text-2xl font-black text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Details / Category
              </label>
              <input
                type="text"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="w-full px-4 py-3 bg-[#182238] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Who Paid?
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditPaidBy(m.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
                      editPaidBy === m.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
                    }`}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Split Participants
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isChecked = editParticipants.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition active:scale-95 cursor-pointer ${
                        isChecked
                          ? "bg-indigo-950/70 border-indigo-500/60 text-indigo-200"
                          : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                          isChecked ? "bg-indigo-500 text-white" : "border border-slate-600"
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>{m.display_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              {updateMutation.isPending ? "Updating..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <>
            {/* Main Expense Card */}
            <div className="p-6 bg-[#121826] border border-white/10 rounded-[26px] space-y-4 shadow-xl">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-2xl mb-2">
                    {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">{expense.details}</h2>
                  <p className="text-xs text-slate-400">
                    Paid by <span className="font-bold text-indigo-400">{payerName}</span> on{" "}
                    {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xl font-black text-emerald-400 block tracking-tight">
                    {formatINR(expense.amount_paise)}
                  </span>
                  {expense.updated_at > expense.created_at && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 font-bold border border-amber-500/30 inline-block mt-1">
                      Edited
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Splits breakdown */}
            <div className="p-5 bg-[#121826] border border-white/10 rounded-[24px] space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Split Breakdown
              </h3>
              <div className="space-y-2">
                {expense.splits?.map((split) => {
                  const name = memberMap.get(split.member_id)?.display_name || "Roommate";
                  return (
                    <div
                      key={split.member_id}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm"
                    >
                      <span className="text-slate-200 font-medium">{name}</span>
                      <span className="font-bold text-white">
                        {formatINR(split.share_paise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Foolproof Delete Action Section */}
            <div className="pt-2">
              {!canDelete ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-400 flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Locked: Only <strong className="text-white">{payerName}</strong> or a Flat Admin can delete this bill to prevent disputes.
                  </span>
                </div>
              ) : !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 text-xs font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Bill...
                </button>
              ) : (
                <div className="p-5 bg-rose-950/30 border border-rose-500/40 rounded-[24px] space-y-3 shadow-lg">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Delete Bill Confirmation</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Deleting removes ₹{formatINR(expense.amount_paise)} from group balances.
                    Don't worry — this bill will be saved in the <strong>Deleted Bills Archive</strong> so any roommate can view or restore it anytime!
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Reason for Deletion
                    </label>
                    <select
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="w-full px-3 py-2 bg-[#182238] border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                    >
                      <option value="Duplicate entry">Duplicate entry</option>
                      <option value="Wrong amount entered">Wrong amount entered</option>
                      <option value="Settled outside / cash">Settled directly outside</option>
                      <option value="Cancelled order">Cancelled order / refunded</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs text-slate-300 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-xs text-white font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
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
