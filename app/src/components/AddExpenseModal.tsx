import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { rupeesToPaise } from "../lib/money";
import type { Member } from "../lib/types";
import { X, Check, Loader2 } from "lucide-react";
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
  { emoji: "⚡", label: "Wifi/Bills" },
  { emoji: "🏠", label: "Rent" },
  { emoji: "🚕", label: "Cab" },
  { emoji: "☕", label: "Chai/Cafe" },
  { emoji: "🎉", label: "Party" },
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

  // Deduplicate members list
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

  function getMemberLabel(m: Member) {
    const isMe = m.user_id === user?.id;
    if (isMe) {
      return `You (${m.display_name.split(" ")[0]})`;
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
        throw new Error("Enter an amount (e.g. ₹150)");
      }
      if (!details.trim()) {
        throw new Error("What was this for? (e.g. Milk, Dinner)");
      }
      if (!paidByMemberId) {
        throw new Error("Select who paid this bill");
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
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal / Native Mobile Bottom Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="relative bg-[#121826] text-white w-full max-w-lg rounded-t-[32px] sm:rounded-[28px] p-5 pb-7 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto border-t sm:border border-white/10"
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  ⚡
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-white tracking-tight">
                    Add Expense
                  </h3>
                  <p className="text-[11px] text-slate-400">Takes under 5 seconds</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-4 pt-3">
              {/* Amount Display */}
              <div className="bg-[#182238] border border-white/10 p-4 rounded-2xl text-center shadow-inner">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Amount Spent
                </span>
                <div className="flex items-center justify-center">
                  <span className="text-3xl font-black text-emerald-400 mr-1.5">₹</span>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="text-4xl sm:text-5xl font-black text-white bg-transparent outline-none max-w-[220px] text-center placeholder-slate-600 tracking-tight"
                  />
                </div>

                {/* Quick Add Chips (Single Clean Row - Never Wraps) */}
                <div className="flex items-center justify-center gap-1.5 mt-3 overflow-x-auto no-scrollbar py-0.5">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-slate-200 active:scale-95 transition whitespace-nowrap cursor-pointer"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* What was it for + Quick Emojis */}
              <div>
                <input
                  type="text"
                  placeholder="What was this for? (e.g. Swiggy, Groceries, Milk)"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                {/* Horizontal Category Slider */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => handleQuickTag(tag.emoji, tag.label)}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-1 whitespace-nowrap active:scale-95 transition cursor-pointer"
                    >
                      <span>{tag.emoji}</span>
                      <span>{tag.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid by */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Who Paid?
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {uniqueMembers.map((member) => {
                    const isSelected = paidByMemberId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setPaidByMemberId(member.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                            : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Split Among ({selectedMemberIds.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedMemberIds(uniqueMembers.map((m) => m.id))}
                    className="text-[11px] text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Equal Split (All)
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {uniqueMembers.map((member) => {
                    const isChecked = selectedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMemberSplit(member.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition active:scale-95 cursor-pointer ${
                          isChecked
                            ? "bg-indigo-950/70 border-indigo-500/60 text-indigo-200"
                            : "bg-white/5 border-white/10 text-slate-400"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                            isChecked
                              ? "bg-indigo-500 text-white"
                              : "border border-slate-600"
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{getMemberLabel(member)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* High-energy Glowing Thumb Button */}
              <button
                type="button"
                disabled={createExpenseMutation.isPending}
                onClick={() => createExpenseMutation.mutate()}
                className="w-full mt-3 py-3.5 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-slate-950 font-black text-sm shadow-[0_4px_24px_rgba(16,185,129,0.4)] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {createExpenseMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Split & Save →"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
