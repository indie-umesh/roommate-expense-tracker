import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import type { Group, Member, Expense, Settlement } from "../lib/types";
import {
  Plus,
  Users,
  CreditCard,
  ChevronLeft,
  Receipt,
} from "lucide-react";

export const GroupHomePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch group details
  const { data: group } = useQuery<Group>({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

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

  // Fetch active expenses with splits
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["group-expenses", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          splits:expense_splits(*)
        `)
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false });
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
  const myMember = members.find((m) => m.user_id === user?.id);

  // Compute Balances & Simplified Transfers
  const memberIds = members.map((m) => m.id);
  const balances = calculateBalances(memberIds, expenses, settlements);
  const simplifiedTransfers = simplifyDebts(balances);

  const myBalance = balances.find((b) => b.memberId === myMember?.id)?.netPaise ?? 0n;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col pb-28">
      {/* Top Header */}
      <header className="px-4 py-3.5 bg-white/80 backdrop-blur-md border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/groups")}
            className="p-1 -ml-1 text-[#86868b] hover:text-[#1d1d1f]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-semibold text-base text-[#1d1d1f] truncate max-w-[200px] tracking-tight">
              {group?.name || "Group"}
            </h1>
            <p className="text-[11px] text-[#86868b]">
              {members.length} roommates • Code: {group?.invite_code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/group/${groupId}/members`)}
            className="p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f0f0f0] transition"
            title="Roommates"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/group/${groupId}/settle`)}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold bg-[#e8f5e9] text-[#2e7d32] rounded-full hover:bg-[#c8e6c9] transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Settle
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {/* Apple Style Balance Card */}
        <div className="p-6 rounded-[22px] bg-white border border-[#e5e5e7] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <p className="text-xs uppercase tracking-wider text-[#86868b] font-semibold">
            Your Balance
          </p>
          <div className="flex justify-between items-baseline mt-1">
            <h2
              className={`text-3xl font-bold tracking-tight ${
                myBalance > 0n
                  ? "text-[#00875a]"
                  : myBalance < 0n
                  ? "text-[#de350b]"
                  : "text-[#1d1d1f]"
              }`}
            >
              {myBalance > 0n
                ? `+${formatINR(myBalance)}`
                : myBalance < 0n
                ? formatINR(myBalance)
                : "₹0"}
            </h2>
            <span className="text-xs text-[#86868b] font-medium">
              {myBalance > 0n
                ? "you are owed in total"
                : myBalance < 0n
                ? "you owe in total"
                : "all settled up"}
            </span>
          </div>

          <div className="mt-5 pt-4 border-t border-[#f0f0f0] space-y-2">
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Settlement Summary
            </p>
            {simplifiedTransfers.length === 0 ? (
              <p className="text-xs text-[#00875a] font-medium">
                ✓ Everyone is settled up!
              </p>
            ) : (
              simplifiedTransfers.map((t, idx) => {
                const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <span className="text-[#1d1d1f]">
                      <span className="font-semibold">{fromName}</span> owes{" "}
                      <span className="font-semibold text-[#0066cc]">{toName}</span>
                    </span>
                    <span className="font-bold text-[#1d1d1f]">{formatINR(t.amountPaise)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Expenses List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-semibold text-sm text-[#1d1d1f] tracking-tight">Recent Expenses</h3>
            <span className="text-xs text-[#86868b]">{expenses.length} logged</span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#d2d2d7]">
              <Receipt className="w-8 h-8 mx-auto text-[#86868b] mb-2 opacity-60" />
              <p className="text-sm font-semibold text-[#1d1d1f]">No expenses recorded yet</p>
              <p className="text-xs text-[#86868b] mt-0.5">
                Tap Add Expense below to split your first bill.
              </p>
            </div>
          ) : (
            expenses.map((expense) => {
              const payerName =
                memberMap.get(expense.paid_by_member_id)?.display_name || "Unknown";
              const isPayerMe = expense.paid_by_member_id === myMember?.id;
              const mySplit = expense.splits?.find(
                (s) => s.member_id === myMember?.id
              );

              return (
                <div
                  key={expense.id}
                  onClick={() => navigate(`/group/${groupId}/expense/${expense.id}`)}
                  className="p-4 bg-white border border-[#e5e5e7] hover:border-[#0066cc]/30 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4 text-[#0066cc]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1d1d1f] line-clamp-1 tracking-tight">
                        {expense.details}
                      </h4>
                      <p className="text-[11px] text-[#86868b]">
                        {isPayerMe ? "You" : payerName} paid •{" "}
                        {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                        {expense.updated_at > expense.created_at && (
                          <span className="ml-1 text-[10px] text-amber-600 font-medium">
                            (edited)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-[#1d1d1f] block tracking-tight">
                      {formatINR(expense.amount_paise)}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        isPayerMe
                          ? "text-[#00875a]"
                          : mySplit
                          ? "text-[#de350b]"
                          : "text-[#86868b]"
                      }`}
                    >
                      {isPayerMe
                        ? `lent ${formatINR(
                            expense.amount_paise - (mySplit?.share_paise || 0n)
                          )}`
                        : mySplit
                        ? `share ${formatINR(mySplit.share_paise)}`
                        : "not involved"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating 3-Tap Add Expense Action */}
      <div className="fixed bottom-5 left-0 right-0 max-w-lg mx-auto px-4 z-30">
        <button
          onClick={() => navigate(`/group/${groupId}/add-expense`)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white font-semibold text-[15px] shadow-[0_4px_16px_rgba(0,102,204,0.35)] transition"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>
    </div>
  );
};
