import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { rupeesToPaise } from "../lib/money";
import type { Member } from "../lib/types";
import { X, Check, Loader2 } from "lucide-react";

export const AddExpensePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const amountInputRef = useRef<HTMLInputElement>(null);

  const [amountRupees, setAmountRupees] = useState("");
  const [details, setDetails] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [spentOn, setSpentOn] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch members
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Default setup: paid by me, split among everyone
  useEffect(() => {
    if (members.length > 0) {
      const myMember = members.find((m) => m.user_id === user?.id);
      if (myMember && !paidByMemberId) {
        setPaidByMemberId(myMember.id);
      } else if (!paidByMemberId) {
        setPaidByMemberId(members[0].id);
      }

      if (selectedMemberIds.length === 0) {
        setSelectedMemberIds(members.map((m) => m.id));
      }
    }
  }, [members, user]);

  // Autofocus amount on mount for instant keypad entry
  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  function toggleMemberSplit(memberId: string) {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  }

  // Create expense mutation using server-side RPC
  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!amountRupees || parseFloat(amountRupees) <= 0) {
        throw new Error("Please enter a valid amount");
      }
      if (!details.trim()) {
        throw new Error("Please enter what this expense was for");
      }
      if (!paidByMemberId) {
        throw new Error("Please select who paid");
      }
      if (selectedMemberIds.length === 0) {
        throw new Error("Must select at least one roommate to split");
      }

      const paise = rupeesToPaise(amountRupees);

      const { data, error } = await supabase.rpc("create_expense", {
        p_group_id: groupId,
        p_paid_by_member_id: paidByMemberId,
        p_amount_paise: paise.toString(), // send string for Postgres bigint
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
      navigate(`/group/${groupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to record expense");
    },
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="px-4 py-4 bg-slate-800/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white">Add Expense</h1>
        <div className="w-6" /> {/* spacer */}
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-5">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* 1. Large Amount Input (Numeric Keypad Opens Immediately) */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 text-center">
          <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Amount
          </label>
          <div className="flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-400 mr-1">₹</span>
            <input
              ref={amountInputRef}
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              className="text-4xl font-extrabold text-white bg-transparent outline-none max-w-[200px] text-center placeholder-slate-600"
            />
          </div>
        </div>

        {/* 2. Details (Single Line Description) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            What was it for?
          </label>
          <input
            type="text"
            placeholder="e.g. Milk & Eggs, Wifi, Electricity bill"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 3. Paid By (Defaults to Me) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Paid by
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const isSelected = paidByMemberId === member.id;
              const isMe = member.user_id === user?.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setPaidByMemberId(member.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600"
                  }`}
                >
                  {isMe ? `You (${member.display_name})` : member.display_name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Split Among (Default = Everyone Selected; Tap to Toggle) */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Split equally among ({selectedMemberIds.length})
            </label>
            <button
              type="button"
              onClick={() => setSelectedMemberIds(members.map((m) => m.id))}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Select all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {members.map((member) => {
              const isChecked = selectedMemberIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMemberSplit(member.id)}
                  className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border transition active:scale-98 ${
                    isChecked
                      ? "bg-slate-800 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  <span className="truncate">{member.display_name}</span>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center ${
                      isChecked
                        ? "bg-blue-600 text-white"
                        : "border border-slate-700"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Date (Defaults to Today) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* One Tap Save Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={createExpenseMutation.isPending}
            onClick={() => createExpenseMutation.mutate()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            {createExpenseMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Save Expense"
            )}
          </button>
        </div>
      </main>
    </div>
  );
};
