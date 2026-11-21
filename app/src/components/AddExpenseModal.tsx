import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { rupeesToPaise } from "../lib/money";
import type { Member } from "../lib/types";
import { X, Check, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AddExpenseModalProps {
  groupId: string;
  members: Member[];
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];
const QUICK_TAGS = [
  { emoji: "🍕", label: "Food" },
  { emoji: "🛒", label: "Groceries" },
  { emoji: "🥛", label: "Milk" },
  { emoji: "⚡", label: "Wifi/Bill" },
  { emoji: "🏠", label: "Rent" },
  { emoji: "🚕", label: "Cab" },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  groupId,
  members,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [amountRupees, setAmountRupees] = useState("");
  const [details, setDetails] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [spentOn] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  // Deduplicate members list in case database has stale ghost duplicates
  const uniqueMembers = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Member[] = [];
    for (const m of members) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
    return result;
  }, [members]);

  // Name counts for disambiguation
  const nameCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of uniqueMembers) {
      const lower = m.display_name.toLowerCase();
      counts.set(lower, (counts.get(lower) || 0) + 1);
    }
    return counts;
  }, [uniqueMembers]);

  function getMemberLabel(m: Member) {
    const isMe = m.user_id === user?.id;
    const isDuplicate = (nameCounts.get(m.display_name.toLowerCase()) || 0) > 1;
    if (isMe) {
      return `You (${m.display_name})`;
    }
    if (isDuplicate) {
      return `${m.display_name} (${m.role === "admin" ? "Admin" : m.id.slice(0, 4)})`;
    }
    return m.display_name;
  }

  // Setup defaults
  useEffect(() => {
    if (isOpen) {
      if (uniqueMembers.length > 0) {
        const myMember = uniqueMembers.find((m) => m.user_id === user?.id);
        if (myMember) {
          setPaidByMemberId(myMember.id);
        } else {
          setPaidByMemberId(uniqueMembers[0].id);
        }
        setSelectedMemberIds(uniqueMembers.map((m) => m.id));
      }
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setAmountRupees("");
      setDetails("");
      setError(null);
    }
  }, [isOpen, uniqueMembers, user]);

  function handleQuickAmount(add: number) {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + add).toString());
  }

  function handleQuickTag(emoji: string, label: string) {
    if (!details) {
      setDetails(`${emoji} ${label}`);
    } else if (!details.includes(label)) {
      setDetails(`${details}, ${label}`);
    }
  }

  function toggleMemberSplit(memberId: string) {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  }

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!amountRupees || parseFloat(amountRupees) <= 0) {
        throw new Error("Enter an amount");
      }
      if (!details.trim()) {
        throw new Error("What was this for?");
      }
      if (!paidByMemberId) {
        throw new Error("Select who paid");
      }
      if (selectedMemberIds.length === 0) {
        throw new Error("Select at least 1 person to split");
      }

      const paise = rupeesToPaise(amountRupees);

      const { data, error } = await supabase.rpc("create_expense", {
        p_group_id: groupId,
        p_paid_by_member_id: paidByMemberId,
        p_amount_paise: paise.toString(),
        p_details: details.trim(),
        p_spent_on: spentOn,
        p_participant_member_ids: selectedMemberIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to record expense");
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Card / Bottom Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#0066cc]" />
                <h3 className="font-bold text-base text-[#1d1d1f] tracking-tight">
                  Add Expense
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-[#86868b] hover:bg-[#f5f5f7] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4 pt-4">
              {/* Amount Display */}
              <div className="bg-[#f5f5f7] p-5 rounded-2xl text-center">
                <div className="flex items-center justify-center">
                  <span className="text-3xl font-semibold text-[#86868b] mr-1">₹</span>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="text-4xl font-extrabold text-[#1d1d1f] bg-transparent outline-none max-w-[200px] text-center placeholder-[#d2d2d7] tracking-tight"
                  />
                </div>

                {/* Quick Add Chips */}
                <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className="px-2.5 py-1 rounded-full bg-white hover:bg-[#f0f0f0] border border-[#d2d2d7] text-xs font-semibold text-[#1d1d1f] active:scale-95 transition shadow-2xs"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* What was it for + Quick Emojis */}
              <div>
                <input
                  type="text"
                  placeholder="What was it for? (e.g. Swiggy, Groceries, Milk)"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0066cc]"
                />
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => handleQuickTag(tag.emoji, tag.label)}
                      className="px-2.5 py-1 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5e7] text-xs font-medium text-[#1d1d1f] flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                    >
                      <span>{tag.emoji}</span>
                      <span>{tag.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid by */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-1.5">
                  Paid By
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueMembers.map((member) => {
                    const isSelected = paidByMemberId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setPaidByMemberId(member.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 ${
                          isSelected
                            ? "bg-[#0066cc] text-white shadow-sm"
                            : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5e7]"
                        }`}
                      >
                        {getMemberLabel(member)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split equally among */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Split Among ({selectedMemberIds.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedMemberIds(uniqueMembers.map((m) => m.id))}
                    className="text-[11px] text-[#0066cc] font-medium hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {uniqueMembers.map((member) => {
                    const isChecked = selectedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMemberSplit(member.id)}
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border transition active:scale-98 ${
                          isChecked
                            ? "bg-white border-[#0066cc] text-[#1d1d1f] shadow-xs"
                            : "bg-[#fbfbfd] border-[#e5e5e7] text-[#86868b]"
                        }`}
                      >
                        <span className="truncate">{getMemberLabel(member)}</span>
                        {isChecked && (
                          <div className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-Tap Save Button */}
              <button
                type="button"
                disabled={createExpenseMutation.isPending}
                onClick={() => createExpenseMutation.mutate()}
                className="w-full mt-2 py-3.5 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white font-bold text-sm shadow-[0_4px_16px_rgba(0,102,204,0.35)] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createExpenseMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Split & Save"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
