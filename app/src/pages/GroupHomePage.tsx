import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import type { Group, Member, Expense, Settlement } from "../lib/types";
import { BottomNav } from "../components/BottomNav";
import type { NavTab } from "../components/BottomNav";
import { ExcelSheetView } from "../components/ExcelSheetView";
import { AddExpenseModal } from "../components/AddExpenseModal";
import confetti from "canvas-confetti";
import {
  ChevronLeft,
  Receipt,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  ArrowRight,
  UserPlus,
  Table,
} from "lucide-react";
import { motion } from "framer-motion";

export const GroupHomePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<NavTab>("activity");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [newRoommateName, setNewRoommateName] = useState("");
  const [newRoommatePayday, setNewRoommatePayday] = useState("");
  const [showAddRoommate, setShowAddRoommate] = useState(false);

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
        .select(`*, splits:expense_splits(*)`)
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

  // Settle Mutation with Confetti!
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
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
    },
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ name, payday }: { name: string; payday?: number | null }) => {
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        user_id: null,
        display_name: name.trim(),
        role: "member",
        payday_day: payday || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setNewRoommateName("");
      setNewRoommatePayday("");
      setShowAddRoommate(false);
    },
  });

  function copyCode() {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function shareWhatsApp() {
    if (!group) return;
    const text = encodeURIComponent(
      `Join our flat on Roommate! Use code: ${group.invite_code} or visit https://app.roommatesexpensemanager.com`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col pb-24 max-w-md mx-auto relative shadow-sm">
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
            <h1 className="font-bold text-base text-[#1d1d1f] tracking-tight">
              {group?.name || "Flat"}
            </h1>
            <p className="text-[11px] text-[#86868b]">
              {members.length} mates • Payday cycle
            </p>
          </div>
        </div>

        {/* Invite Code Pill */}
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f5ff] hover:bg-[#e1edff] text-[#0066cc] rounded-full text-xs font-semibold tracking-wider transition active:scale-95"
          title="Click to copy invite code"
        >
          {copiedCode ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#00875a]" />
              <span className="text-[#00875a]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 opacity-70" />
              <span>{group?.invite_code || "ROOM-0000"}</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content Sections based on Active Tab */}
      <main className="flex-1 p-4 space-y-4">
        {/* TAB 1: ACTIVITY / HOME */}
        {activeTab === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Gen-Z Hero Balance Card */}
            <div className="p-6 rounded-[26px] bg-white border border-[#e5e5e7] shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                  Net Status
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f5f7] font-semibold text-[#1d1d1f]">
                  {myBalance > 0n
                    ? "In Profit 🎉"
                    : myBalance < 0n
                    ? "In Debt 💀"
                    : "Even Stevens 😎"}
                </span>
              </div>

              <div className="mt-3">
                <h2
                  className={`text-4xl font-black tracking-tight ${
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
                <p className="text-xs text-[#86868b] mt-1 font-medium">
                  {myBalance > 0n
                    ? "Your roommates owe you this amount"
                    : myBalance < 0n
                    ? "You need to pay back this amount"
                    : "All settled up. Zero stress!"}
                </p>
              </div>

              {/* Settlement Summary in Plain Words */}
              <div className="mt-5 pt-4 border-t border-[#f0f0f0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                    Who Pays Whom
                  </span>
                  <button
                    onClick={() => setActiveTab("settle")}
                    className="text-[11px] text-[#0066cc] font-semibold hover:underline"
                  >
                    Settle up →
                  </button>
                </div>

                {simplifiedTransfers.length === 0 ? (
                  <p className="text-xs text-[#00875a] font-semibold">
                    ✓ All accounts balanced to zero!
                  </p>
                ) : (
                  simplifiedTransfers.map((t, idx) => {
                    const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                    const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <div className="flex items-center gap-1.5 text-[#1d1d1f]">
                          <span className="font-semibold text-rose-600">{fromName}</span>
                          <ArrowRight className="w-3 h-3 text-[#86868b]" />
                          <span className="font-semibold text-[#0066cc]">{toName}</span>
                        </div>
                        <span className="font-bold text-[#1d1d1f]">
                          {formatINR(t.amountPaise)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* View Switcher Pill */}
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm text-[#1d1d1f]">Recent Expenses</h3>
              <button
                onClick={() => setActiveTab("sheet")}
                className="flex items-center gap-1 text-xs text-[#0066cc] font-semibold hover:underline"
              >
                <Table className="w-3.5 h-3.5" />
                Open Excel Sheet View →
              </button>
            </div>

            {/* Expense Cards */}
            {expenses.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#d2d2d7]">
                <Receipt className="w-8 h-8 text-[#86868b] mx-auto mb-1.5 opacity-50" />
                <p className="text-sm font-semibold text-[#1d1d1f]">No expenses yet</p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Tap the + button below to log your first bill!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.slice(0, 10).map((expense) => {
                  const payer = memberMap.get(expense.paid_by_member_id);
                  const isPayerMe = expense.paid_by_member_id === myMember?.id;
                  const mySplit = expense.splits?.find((s) => s.member_id === myMember?.id);

                  return (
                    <div
                      key={expense.id}
                      onClick={() => navigate(`/group/${groupId}/expense/${expense.id}`)}
                      className="p-3.5 bg-white border border-[#e5e5e7] hover:border-[#0066cc]/30 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold text-base">
                          {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[#1d1d1f] line-clamp-1 tracking-tight">
                            {expense.details}
                          </h4>
                          <p className="text-[11px] text-[#86868b]">
                            {isPayerMe ? "You" : payer?.display_name || "Roommate"} paid •{" "}
                            {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-[#1d1d1f] block tracking-tight">
                          {formatINR(expense.amount_paise)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
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
                            : "not in split"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: EXCEL-STYLE SHEET VIEW */}
        {activeTab === "sheet" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-bold text-base text-[#1d1d1f]">Spreadsheet View</h2>
                <p className="text-xs text-[#86868b]">
                  Instant matrix view with individual shares & totals.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-xs text-[#0066cc] font-semibold hover:underline"
              >
                Back to Feed
              </button>
            </div>

            <ExcelSheetView
              members={members}
              expenses={expenses}
              onSelectExpense={(id) => navigate(`/group/${groupId}/expense/${id}`)}
            />
          </motion.div>
        )}

        {/* TAB 3: SETTLE UP */}
        {activeTab === "settle" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-6 bg-white border border-[#e5e5e7] rounded-[26px] shadow-sm">
              <h2 className="text-base font-bold text-[#1d1d1f] mb-1">
                Minimal Transfers
              </h2>
              <p className="text-xs text-[#86868b] mb-4">
                Algorithmically simplified to clear all debts in the fewest transactions.
              </p>

              {simplifiedTransfers.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-2">🎉</div>
                  <h4 className="font-bold text-[#00875a] text-base">All Square!</h4>
                  <p className="text-xs text-[#86868b] mt-1">
                    Nobody owes anything in this flat right now.
                  </p>
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
                            <span className="font-bold text-rose-600">{fromName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#86868b]" />
                            <span className="font-bold text-[#0066cc]">{toName}</span>
                          </div>
                          <span className="text-xl font-extrabold text-[#1d1d1f] mt-1 block tracking-tight">
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
                          className="px-4 py-2.5 rounded-full bg-[#00875a] hover:bg-[#00704a] text-white font-bold text-xs transition active:scale-95 shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Paid
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 4: ROOMMATES / MEMBERS */}
        {activeTab === "members" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Invite Card */}
            <div className="p-6 bg-white border border-[#e5e5e7] rounded-[26px] space-y-3 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                Flat Invite Code
              </span>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-[#1d1d1f] tracking-widest">
                  {group?.invite_code || "ROOM-0000"}
                </span>
                <button
                  onClick={copyCode}
                  className="p-3 bg-[#f5f5f7] hover:bg-[#e5e5e7] rounded-full transition"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-[#00875a]" /> : <Copy className="w-5 h-5 text-[#1d1d1f]" />}
                </button>
              </div>

              <button
                onClick={shareWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-98 transition"
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </button>
            </div>

            {/* Roommates List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-sm text-[#1d1d1f]">
                  Roommates ({members.length})
                </h3>
                <button
                  onClick={() => setShowAddRoommate(true)}
                  className="flex items-center gap-1 text-xs text-[#0066cc] font-semibold hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Add Roommate
                </button>
              </div>

              {/* Add Roommate Inline Sheet */}
              {showAddRoommate && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newRoommateName.trim()) {
                      addMemberMutation.mutate({
                        name: newRoommateName,
                        payday: newRoommatePayday ? parseInt(newRoommatePayday, 10) : null,
                      });
                    }
                  }}
                  className="p-4 bg-white border border-[#0066cc]/40 rounded-2xl space-y-3 shadow-sm"
                >
                  <h4 className="font-bold text-xs text-[#1d1d1f]">Quick Add Roommate</h4>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Roommate Name (e.g. Aman, Ritesh)"
                    value={newRoommateName}
                    onChange={(e) => setNewRoommateName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f]"
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Payday Date (e.g. 1st, 5th, 15th)"
                    value={newRoommatePayday}
                    onChange={(e) => setNewRoommatePayday(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRoommate(false)}
                      className="px-3 py-1.5 text-xs text-[#86868b]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="px-4 py-1.5 bg-[#0066cc] text-white text-xs font-semibold rounded-full"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {/* Members Chips/Cards */}
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 bg-white border border-[#e5e5e7] rounded-2xl flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#f0f5ff] text-[#0066cc] font-extrabold text-xs flex items-center justify-center">
                        {member.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1d1d1f]">
                          {member.display_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
                          <span>{member.user_id ? "Joined" : "Ghost (Unclaimed)"}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-[#1d1d1f]">
                            <Calendar className="w-3 h-3 text-[#0066cc]" />
                            {member.payday_day ? `Payday: ${member.payday_day}th` : "No payday"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {member.role === "admin" && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-bold">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Modern Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* 3-Tap Quick Add Expense Modal */}
      <AddExpenseModal
        groupId={groupId!}
        members={members}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
