import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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
  Home,
  CreditCard,
  Users,
  Plus,
  AlertCircle,
  Clock,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "framer-motion";

export const GroupHomePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<NavTab>("activity");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [newRoommateFirstName, setNewRoommateFirstName] = useState("");
  const [newRoommateSurname, setNewRoommateSurname] = useState("");
  const [newRoommatePayday, setNewRoommatePayday] = useState("");
  const [showAddRoommate, setShowAddRoommate] = useState(false);
  const [showDeletedBills, setShowDeletedBills] = useState(false);
  const [addRoommateError, setAddRoommateError] = useState<string | null>(null);

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
        amount_paise: exp.amount_paise ? BigInt(String(exp.amount_paise).split(".")[0]) : 0n,
        splits: (exp.splits || []).map((s: any) => ({
          ...s,
          share_paise: s.share_paise ? BigInt(String(s.share_paise).split(".")[0]) : 0n,
        })),
      }));
    },
    enabled: !!groupId,
  });

  // Fetch soft-deleted expenses for the Dispute-Proof Archive
  const { data: deletedExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["group-deleted-expenses", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`*, splits:expense_splits(*)`)
        .eq("group_id", groupId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((exp: any) => ({
        ...exp,
        amount_paise: exp.amount_paise ? BigInt(String(exp.amount_paise).split(".")[0]) : 0n,
        splits: (exp.splits || []).map((s: any) => ({
          ...s,
          share_paise: s.share_paise ? BigInt(String(s.share_paise).split(".")[0]) : 0n,
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
        amount_paise: s.amount_paise ? BigInt(String(s.amount_paise).split(".")[0]) : 0n,
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

  // Realtime duplicate detection for new roommate
  const enteredFirstName = newRoommateFirstName.trim().toLowerCase();
  const duplicateCandidate = members.find((m) => {
    if (!enteredFirstName) return false;
    const existingParts = (m.display_name || "").trim().toLowerCase().split(/\s+/);
    return existingParts[0] === enteredFirstName;
  });

  // Settle Mutation with Confetti
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

  // Restore Deleted Expense Mutation (1-Click Undo)
  const restoreExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      confetti({
        particleCount: 60,
        spread: 50,
      });
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-deleted-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
    },
  });

  // Add Member Mutation with Duplicate Name Safeguard
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
      setNewRoommateFirstName("");
      setNewRoommateSurname("");
      setNewRoommatePayday("");
      setShowAddRoommate(false);
      setAddRoommateError(null);
    },
  });

  function handleAddRoommateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const first = newRoommateFirstName.trim();
    const surname = newRoommateSurname.trim();

    if (!first) {
      setAddRoommateError("Please enter a roommate name.");
      return;
    }

    if (duplicateCandidate && !surname) {
      setAddRoommateError(
        `A roommate named "${duplicateCandidate.display_name}" already exists! Please provide a surname or initial to avoid confusion.`
      );
      return;
    }

    const fullName = surname ? `${first} ${surname}` : first;
    const exactMatch = members.some(
      (m) => m.display_name.trim().toLowerCase() === fullName.toLowerCase()
    );
    if (exactMatch) {
      setAddRoommateError(`A roommate with the exact name "${fullName}" already exists.`);
      return;
    }

    setAddRoommateError(null);
    addMemberMutation.mutate({
      name: fullName,
      payday: newRoommatePayday ? parseInt(newRoommatePayday, 10) : null,
    });
  }

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
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col pb-24 md:pb-8 w-full selection:bg-emerald-500 selection:text-slate-950">
      {/* Responsive Top Navigation Header */}
      <header className="px-4 md:px-8 py-3.5 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back & Group Name */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/groups")}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              title="Back to all flats"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div>
              <h1 className="font-black text-base md:text-lg text-white tracking-tight">
                {group?.name || "Flat"}
              </h1>
              <p className="text-[11px] md:text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <span>{members.length} mates</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">
                  Paydays: {members.filter((m) => m.payday_day).map((m) => `${(m.display_name || "Mate").split(" ")[0]} (${m.payday_day}th)`).join(", ") || "Active"}
                </span>
              </p>
            </div>
          </div>

          {/* Center: Tablet / Desktop Navigation Pills (Hidden on mobile, visible on md+) */}
          <div className="hidden md:flex items-center bg-[#182238] p-1 rounded-full border border-white/10">
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                activeTab === "activity"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("sheet")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                activeTab === "sheet"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Spreadsheet Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab("settle")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                activeTab === "settle"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Settle Up</span>
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                activeTab === "members"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Roommates</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Invite Code Pill */}
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-emerald-400 rounded-full text-xs font-bold tracking-wider transition active:scale-95 border border-emerald-500/30 cursor-pointer"
              title="Click to copy invite code"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 opacity-80" />
                  <span>{group?.invite_code || "ROOM-0000"}</span>
                </>
              )}
            </button>

            {/* Desktop / iPad Add Expense CTA */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 rounded-full text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Expense</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Sections based on Active Tab */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-4xl lg:max-w-6xl xl:max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: ACTIVITY / OVERVIEW DASHBOARD */}
        {activeTab === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Multi-column Grid on Tablet & Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left Column: Net Status & Financial Summary (span 5 on md/lg) */}
              <div className="md:col-span-5 space-y-4">
                {/* Gen-Z Hero Balance Card */}
                <div className="p-6 rounded-[28px] bg-[#121826] border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Your Net Balance
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                      myBalance > 0n
                        ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
                        : myBalance < 0n
                        ? "bg-rose-950/80 text-rose-400 border-rose-500/40"
                        : "bg-white/5 text-slate-300 border-white/10"
                    }`}>
                      {myBalance > 0n
                        ? "In Profit 🎉"
                        : myBalance < 0n
                        ? "In Debt 💀"
                        : "Even Stevens 😎"}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h2
                      className={`text-4xl lg:text-5xl font-black tracking-tight ${
                        myBalance > 0n
                          ? "text-emerald-400"
                          : myBalance < 0n
                          ? "text-rose-400"
                          : "text-white"
                      }`}
                    >
                      {myBalance > 0n
                        ? `+${formatINR(myBalance)}`
                        : myBalance < 0n
                        ? formatINR(myBalance)
                        : "₹0"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {myBalance > 0n
                        ? "Roommates owe you this. Pure profit!"
                        : myBalance < 0n
                        ? "You owe roommates. Settle up when ready!"
                        : "All settled up. Zero debt!"}
                    </p>
                  </div>

                  {/* Settlement Summary in Plain Words */}
                  <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Who Pays Whom
                      </span>
                      <button
                        onClick={() => setActiveTab("settle")}
                        className="text-[11px] text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Settle up →
                      </button>
                    </div>

                    {simplifiedTransfers.length === 0 ? (
                      <p className="text-xs text-emerald-400 font-bold">
                        ✓ All accounts balanced to zero!
                      </p>
                    ) : (
                      simplifiedTransfers.slice(0, 3).map((t, idx) => {
                        const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                        const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1"
                          >
                            <div className="flex items-center gap-1.5 text-white">
                              <span className="font-bold text-rose-400">{fromName}</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="font-bold text-emerald-400">{toName}</span>
                            </div>
                            <span className="font-black text-white">
                              {formatINR(t.amountPaise)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Payday Cycles Card */}
                <div className="p-5 bg-[#121826] border border-white/10 rounded-[26px] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Payday Calendar
                    </span>
                    <button
                      onClick={() => setActiveTab("members")}
                      className="text-[11px] text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Manage →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
                      >
                        <span className="font-semibold text-slate-200">{m.display_name}</span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white/5 text-emerald-400 border border-emerald-500/20">
                          {m.payday_day ? `${m.payday_day}th of month` : "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispute Prevention: Deleted Bills Archive Toggle */}
                {deletedExpenses.length > 0 && (
                  <div className="p-4 bg-[#121826] border border-amber-500/30 rounded-[22px] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">
                          Deleted Bills Archive ({deletedExpenses.length})
                        </span>
                      </div>
                      <button
                        onClick={() => setShowDeletedBills(!showDeletedBills)}
                        className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showDeletedBills ? "Hide" : "Review"}</span>
                        {showDeletedBills ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {showDeletedBills && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <p className="text-[11px] text-slate-400">
                          No secret deletions: any deleted bill can be inspected and restored by any flatmate with 1 tap!
                        </p>
                        {deletedExpenses.map((delExp) => {
                          const payer = memberMap.get(delExp.paid_by_member_id);
                          return (
                            <div
                              key={delExp.id}
                              className="p-3 bg-[#182238] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div>
                                <h5 className="font-bold text-white line-clamp-1">
                                  {delExp.details}
                                </h5>
                                <span className="text-[10px] text-slate-400">
                                  {formatINR(delExp.amount_paise)} • Paid by {payer?.display_name || "Unknown"}
                                </span>
                              </div>
                              <button
                                onClick={() => restoreExpenseMutation.mutate(delExp.id)}
                                disabled={restoreExpenseMutation.isPending}
                                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-full font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Restore
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Recent Expenses Feed (span 7 on md/lg) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-black text-sm md:text-base text-white">
                    Recent Expenses ({expenses.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("sheet")}
                    className="flex items-center gap-1 text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    <Table className="w-3.5 h-3.5" />
                    Open Spreadsheet Matrix →
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div className="text-center py-12 bg-[#121826] rounded-2xl border border-dashed border-white/10">
                    <Receipt className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-white">No expenses logged yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tap the + button to add your first bill in under 5 seconds!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {expenses.slice(0, 15).map((expense) => {
                      const payer = memberMap.get(expense.paid_by_member_id);
                      const isPayerMe = expense.paid_by_member_id === myMember?.id;
                      const mySplit = expense.splits?.find((s) => s.member_id === myMember?.id);

                      return (
                        <div
                          key={expense.id}
                          onClick={() => navigate(`/group/${groupId}/expense/${expense.id}`)}
                          className="p-4 bg-[#121826] border border-white/10 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-md hover:shadow-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                              {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white line-clamp-1 tracking-tight">
                                {expense.details}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {isPayerMe ? "You" : payer?.display_name || "Roommate"} paid •{" "}
                                {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm md:text-base font-black text-white block tracking-tight">
                              {formatINR(expense.amount_paise)}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                isPayerMe
                                  ? "text-emerald-400"
                                  : mySplit
                                  ? "text-rose-400"
                                  : "text-slate-400"
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
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: EXCEL-STYLE FULL SHEET VIEW */}
        {activeTab === "sheet" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-black text-base md:text-lg text-white">Spreadsheet View</h2>
                <p className="text-xs text-slate-400">
                  Full ledger matrix showing each roommate's exact share & net balances.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                Back to Feed
              </button>
            </div>

            {/* Widescreen Matrix View */}
            <ExcelSheetView
              members={members}
              expenses={expenses}
              onSelectExpense={(id) => navigate(`/group/${groupId}/expense/${id}`)}
            />
          </motion.div>
        )}

        {/* TAB 3: SETTLE UP (MINIMAL TRANSFERS) */}
        {activeTab === "settle" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-6 md:p-8 bg-[#121826] border border-white/10 rounded-[28px] shadow-xl">
              <h2 className="text-base md:text-lg font-black text-white mb-1">
                Minimal Transfers
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Calculated to settle every roommate's balance in the fewest payments possible.
              </p>

              {simplifiedTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎉</div>
                  <h4 className="font-black text-emerald-400 text-lg">All Settled Up!</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Nobody owes anything in this flat right now. Zero debt!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {simplifiedTransfers.map((t, idx) => {
                    const fromName = memberMap.get(t.fromMemberId)?.display_name || "Someone";
                    const toName = memberMap.get(t.toMemberId)?.display_name || "Someone";

                    return (
                      <div
                        key={idx}
                        className="p-5 bg-[#182238] border border-white/10 hover:border-emerald-500/40 rounded-2xl flex flex-col justify-between gap-4 transition shadow-md"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-bold text-rose-400 text-sm">{fromName}</span>
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                            <span className="font-bold text-emerald-400 text-sm">{toName}</span>
                          </div>
                          <span className="text-3xl font-black text-white mt-2 block tracking-tight">
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
                          className="w-full py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Paid & Settle
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
            className="space-y-6"
          >
            {/* Flat Invite Banner */}
            <div className="p-6 md:p-8 bg-[#121826] border border-white/10 rounded-[28px] shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Flat Invite Code
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl md:text-4xl font-black text-emerald-400 tracking-widest">
                    {group?.invite_code || "ROOM-0000"}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition cursor-pointer border border-white/10"
                    title="Copy code"
                  >
                    {copiedCode ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Share this code with roommates so they can join and claim their spot instantly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-md active:scale-98 transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  Share via WhatsApp
                </button>
              </div>
            </div>

            {/* Roommates List Header & Add Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-black text-sm md:text-base text-white">
                  Roommates ({members.length})
                </h3>
                <button
                  onClick={() => setShowAddRoommate(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Add Roommate
                </button>
              </div>

              {/* Add Roommate Modal / Inline Card with Duplicate Name Disambiguation */}
              {showAddRoommate && (
                <form
                  onSubmit={handleAddRoommateSubmit}
                  className="p-5 bg-[#121826] border-2 border-emerald-500/40 rounded-2xl space-y-3.5 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">Add New Roommate</h4>
                    <span className="text-[11px] text-slate-400">
                      They can claim this spot when they sign up!
                    </span>
                  </div>

                  {addRoommateError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{addRoommateError}</span>
                    </div>
                  )}

                  {duplicateCandidate && (
                    <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        Notice: A roommate named "
                        <span className="underline">{duplicateCandidate.display_name}</span>" is
                        already in this flat. Please provide a <strong>Surname or Initial</strong> below so
                        bills stay distinct.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Aman, Ritesh"
                        value={newRoommateFirstName}
                        onChange={(e) => {
                          setNewRoommateFirstName(e.target.value);
                          setAddRoommateError(null);
                        }}
                        className="w-full px-3 py-2 bg-[#182238] border border-white/10 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Surname / Initial {duplicateCandidate ? "(Required)" : "(Optional)"}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sharma, G."
                        value={newRoommateSurname}
                        onChange={(e) => {
                          setNewRoommateSurname(e.target.value);
                          setAddRoommateError(null);
                        }}
                        className={`w-full px-3 py-2 bg-[#182238] border rounded-xl text-xs text-white focus:outline-none ${
                          duplicateCandidate
                            ? "border-amber-400 bg-amber-950/30 focus:border-amber-500"
                            : "border-white/10 focus:border-emerald-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Salary / Payday (1-31)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="e.g. 1st, 5th, 15th"
                        value={newRoommatePayday}
                        onChange={(e) => setNewRoommatePayday(e.target.value)}
                        className="w-full px-3 py-2 bg-[#182238] border border-white/10 focus:border-emerald-500 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRoommate(false);
                        setAddRoommateError(null);
                      }}
                      className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 text-xs font-black rounded-full shadow-md transition active:scale-95 cursor-pointer"
                    >
                      {addMemberMutation.isPending ? "Adding..." : "Save Roommate"}
                    </button>
                  </div>
                </form>
              )}

              {/* Responsive Roommate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 bg-[#121826] border border-white/10 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                        {member.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{member.display_name}</span>
                          {member.user_id === user?.id && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                              You
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>{member.user_id ? "Active user" : "Unclaimed ghost"}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-300">
                            <Calendar className="w-3 h-3 text-emerald-400" />
                            {member.payday_day ? `Payday: ${member.payday_day}th` : "No payday set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {member.role === "admin" && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 font-bold">
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

      {/* Floating Bottom Navigation Bar (Visible on mobile, hidden on tablet/desktop md+) */}
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
