import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { rupeesToPaise } from "../lib/money";
import type { Member } from "../lib/types";
import { X, Check, Loader2 } from "lucide-react";

export const AddExpensePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const amountInputRef = useRef<HTMLInputElement>(null);

  const [amountRupees, setAmountRupees] = useState("");
  const [details, setDetails] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [spentOn] = useState<string>(
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

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!amountRupees || parseFloat(amountRupees) <= 0) {
        throw new Error("Enter a valid amount");
      }
      if (!details.trim()) {
        throw new Error("Enter expense details");
      }
      if (!paidByMemberId) {
        throw new Error("Select who paid");
      }
      if (selectedMemberIds.length === 0) {
        throw new Error("Select at least one participant");
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
      navigate(`/group/${groupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create expense");
    },
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col pb-8">
      <header className="px-4 py-3.5 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white tracking-tight">{t("add_expense")}</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-5">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Large Hero Amount Input */}
        <div className="bg-[#121826] p-6 rounded-[28px] border border-white/10 text-center shadow-xl">
          <label className="block text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
            {t("amount_inr")}
          </label>
          <div className="flex items-center justify-center">
            <span className="text-3xl font-black text-emerald-400 mr-1.5">₹</span>
            <input
              ref={amountInputRef}
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              className="text-4xl font-black text-white bg-transparent outline-none max-w-[200px] text-center placeholder-slate-600 tracking-tight"
            />
          </div>
        </div>

        {/* Details */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">
            {t("what_for")}
          </label>
          <input
            type="text"
            placeholder="e.g. Milk & Groceries, Wifi, Rent"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full px-4 py-3 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Paid By */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">
            {t("who_paid")}
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
                  className={`px-4 py-2 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-[#121826] text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {isMe ? `${t("you")} (${member.display_name})` : member.display_name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Among */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-slate-400">
              {t("split_equally")} ({selectedMemberIds.length})
            </label>
            <button
              type="button"
              onClick={() => setSelectedMemberIds(members.map((m) => m.id))}
              className="text-[11px] text-indigo-400 hover:underline font-bold"
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
                  className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border transition active:scale-98 cursor-pointer ${
                    isChecked
                      ? "bg-indigo-950/70 border-indigo-500/60 text-indigo-200"
                      : "bg-[#121826] border-white/10 text-slate-400"
                  }`}
                >
                  <span className="truncate">{member.display_name}</span>
                  {isChecked && (
                    <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={createExpenseMutation.isPending}
          onClick={() => createExpenseMutation.mutate()}
          className="w-full mt-4 py-3.5 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 active:scale-[0.98] text-slate-950 font-black text-sm shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {createExpenseMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t("save_expense")
          )}
        </button>
      </main>
    </div>
  );
};
