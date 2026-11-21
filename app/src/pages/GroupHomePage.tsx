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
  TrendingUp,
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col pb-24">
      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-800/90 backdrop-blur border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/groups")}
            className="p-1 -ml-1 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-bold text-base text-white truncate max-w-[200px]">
              {group?.name || "Group"}
            </h1>
            <p className="text-[11px] text-slate-400">
              {members.length} roommates • Code: {group?.invite_code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/group/${groupId}/members`)}
            className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-700/60"
            title="Members"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/group/${groupId}/settle`)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Settle
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {/* Top Balance Summary Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-700/80 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Your Net Balance
              </p>
              <h2
                className={`text-2xl font-extrabold mt-1 ${
                  myBalance > 0n
                    ? "text-emerald-400"
                    : myBalance < 0n
                    ? "text-rose-400"
                    : "text-slate-300"
                }`}
              >
                {myBalance > 0n
                  ? `+${formatINR(myBalance)}`
                  : myBalance < 0n
                  ? formatINR(myBalance)
                  : "₹0"}
              </h2>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-700/50 text-slate-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-1.5">
            <p className="text-xs font-semibold text-slate-300">
              Who owes whom:
            </p>
            {simplifiedTransfers.length === 0 ? (
              <p className="text-xs text-emerald-400 font-medium">
                ✓ All settled up! Nobody owes anything.
              </p>
            ) : (
              simplifiedTransfers.map((t, idx) => {
                const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                return (
                  <p key={idx} className="text-xs text-slate-300">
                    <span className="font-semibold text-rose-300">{fromName}</span> owes{" "}
                    <span className="font-semibold text-emerald-300">{toName}</span>{" "}
                    <span className="font-bold text-white">{formatINR(t.amountPaise)}</span>
                  </p>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Expenses List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">Recent Expenses</h3>
            <span className="text-xs text-slate-500">{expenses.length} total</span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-10 bg-slate-800/40 rounded-2xl border border-dashed border-slate-800">
              <Receipt className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No expenses recorded yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tap the button below to add your first expense
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
                  className="p-3.5 bg-slate-800/90 border border-slate-700/60 rounded-xl flex items-center justify-between hover:border-slate-600 cursor-pointer active:scale-[0.99] transition shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/60 text-slate-300 flex items-center justify-center font-bold">
                      <Receipt className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100 line-clamp-1">
                        {expense.details}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {isPayerMe ? "You" : payerName} paid •{" "}
                        {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                        {expense.updated_at > expense.created_at && (
                          <span className="ml-1.5 text-[10px] text-amber-400/90 font-medium">
                            (edited)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-white block">
                      {formatINR(expense.amount_paise)}
                    </span>
                    <span
                      className={`text-[11px] ${
                        isPayerMe
                          ? "text-emerald-400"
                          : mySplit
                          ? "text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {isPayerMe
                        ? `you lent ${formatINR(
                            expense.amount_paise - (mySplit?.share_paise || 0n)
                          )}`
                        : mySplit
                        ? `your share: ${formatINR(mySplit.share_paise)}`
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
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-base shadow-xl shadow-blue-600/40 transition border border-blue-400/30"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>
    </div>
  );
};
