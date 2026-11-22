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
  Receipt,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  Table,
  Home,
  CreditCard,
  Users,
  Plus,
  AlertCircle,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

export const GroupHomePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<NavTab>("activity");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [newRoommateFirstName, setNewRoommateFirstName] = useState("");
  const [newRoommateSurname, setNewRoommateSurname] = useState("");
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
        .order("settled_on", { ascending: false });
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
  const totalGroupSpent = expenses.reduce((sum, e) => sum + e.amount_paise, 0n);

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

  // Add Member Mutation with Duplicate Name Safeguard (Zero payday baggage)
  const addMemberMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        user_id: null,
        display_name: name.trim(),
        role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setNewRoommateFirstName("");
      setNewRoommateSurname("");
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
    addMemberMutation.mutate({ name: fullName });
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
      `Join our flat on Roommate! Use code: ${group.invite_code} to split bills and track expenses together!`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col pb-24 md:pb-8 w-full transition-colors duration-200">
      {/* Top Main App Header (Clean Single-Flat Navigation) */}
      <header className="px-4 md:px-8 py-3.5 bg-white/85 dark:bg-[#121826]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: App Logo & Flat Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl btn-3d-indigo flex items-center justify-center text-white font-black text-sm shrink-0">
              ₹
            </div>
            <div>
              <h1 className="font-black text-base md:text-lg text-[var(--text-primary)] tracking-tight">
                {group?.name || "Indore Flat"}
              </h1>
              <p className="text-[11px] md:text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <span>{members.length} roommates</span>
                <span>•</span>
                <span>Signed in as <strong className="text-indigo-600 dark:text-indigo-400">{profile?.display_name || "User"}</strong></span>
              </p>
            </div>
          </div>

          {/* Center: Tablet / Desktop Navigation Pills (Hidden on mobile, visible on md+) */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#182238] p-1 rounded-2xl border border-slate-200/80 dark:border-white/10">
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "activity"
                  ? "btn-3d-indigo text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("sheet")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "sheet"
                  ? "btn-3d-indigo text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Spreadsheet Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab("settle")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "settle"
                  ? "btn-3d-indigo text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Settle Up</span>
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "members"
                  ? "btn-3d-indigo text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
              className="btn-3d-surface flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider cursor-pointer"
              title="Click to copy invite code"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-indigo-600 dark:text-indigo-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 opacity-70 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{group?.invite_code || "INDORE"}</span>
                </>
              )}
            </button>

            {/* Desktop / iPad Add Expense CTA */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 btn-3d-indigo rounded-xl text-xs font-black"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Expense</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn-3d-surface p-2 rounded-full cursor-pointer flex items-center justify-center"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={() => signOut()}
              className="btn-3d-surface p-2 rounded-full cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
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
                {/* 3D Elevated Net Balance Card */}
                <div className="card-3d p-6 sm:p-7 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                      Your Net Balance
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-extrabold border ${
                      myBalance > 0n
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : myBalance < 0n
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        : "bg-slate-100 dark:bg-white/5 text-[var(--text-muted)] border-slate-200 dark:border-white/10"
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
                          ? "text-amber-500 dark:text-amber-400"
                          : myBalance < 0n
                          ? "text-rose-500 dark:text-rose-400"
                          : "text-[var(--text-primary)]"
                      }`}
                    >
                      {myBalance > 0n
                        ? `+${formatINR(myBalance)}`
                        : myBalance < 0n
                        ? formatINR(myBalance)
                        : "₹0"}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                      {myBalance > 0n
                        ? "Roommates owe you this. Pure profit!"
                        : myBalance < 0n
                        ? "You owe roommates. Settle up when ready!"
                        : "All settled up. Zero debt!"}
                    </p>
                  </div>

                  {/* Settlement Summary in Plain Words */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                        Who Pays Whom
                      </span>
                      <button
                        onClick={() => setActiveTab("settle")}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                      >
                        Settle up →
                      </button>
                    </div>

                    {simplifiedTransfers.length === 0 ? (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
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
                            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
                              <span className="font-bold text-rose-500 dark:text-rose-400">{fromName}</span>
                              <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{toName}</span>
                            </div>
                            <span className="font-black text-[var(--text-primary)]">
                              {formatINR(t.amountPaise)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Flat Snapshot Overview Card (Zero Payday Baggage) */}
                <div className="card-3d p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Flat Snapshot
                    </span>
                    <button
                      onClick={() => setActiveTab("members")}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                    >
                      Roommates ({members.length}) →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Total Spent</span>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {formatINR(totalGroupSpent)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Total Bills</span>
                      <span className="text-lg font-black text-[var(--text-primary)] block mt-0.5">
                        {expenses.length}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={shareWhatsApp}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs shadow-[0_4px_0_0_#15803d] active:translate-y-[2px] active:shadow-[0_2px_0_0_#15803d] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Invite via WhatsApp
                  </button>
                </div>

                {/* Dispute Prevention: Deleted Bills Archive */}
                {deletedExpenses.length > 0 && (
                  <div className="card-3d p-5 border-amber-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Deleted Bills Archive ({deletedExpenses.length})
                        </span>
                      </div>
                      <button
                        onClick={() => setShowDeletedBills(!showDeletedBills)}
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showDeletedBills ? "Hide" : "Review"}</span>
                        {showDeletedBills ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {showDeletedBills && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/10">
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                          No disputes: any deleted bill can be reviewed and restored with 1 tap!
                        </p>
                        {deletedExpenses.map((delExp) => {
                          const payer = memberMap.get(delExp.paid_by_member_id);
                          return (
                            <div
                              key={delExp.id}
                              className="p-3 bg-slate-50 dark:bg-[#182238] border border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div>
                                <h5 className="font-bold text-[var(--text-primary)] line-clamp-1">
                                  {delExp.details}
                                </h5>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {formatINR(delExp.amount_paise)} • Paid by {payer?.display_name || "Unknown"}
                                </span>
                              </div>
                              <button
                                onClick={() => restoreExpenseMutation.mutate(delExp.id)}
                                disabled={restoreExpenseMutation.isPending}
                                className="px-3 py-1 btn-3d-amber rounded-lg font-bold text-[11px] flex items-center gap-1"
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
                  <h3 className="font-black text-sm md:text-base text-[var(--text-primary)]">
                    Recent Expenses ({expenses.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("sheet")}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                  >
                    <Table className="w-3.5 h-3.5" />
                    Open Spreadsheet Matrix →
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div className="card-3d text-center py-12 p-6">
                    <Receipt className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-base font-extrabold text-[var(--text-primary)]">No expenses logged yet</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Tap the + button to add your first bill in under 5 seconds!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.slice(0, 15).map((expense) => {
                      const payer = memberMap.get(expense.paid_by_member_id);
                      const isPayerMe = expense.paid_by_member_id === myMember?.id;
                      const mySplit = expense.splits?.find((s) => s.member_id === myMember?.id);

                      return (
                        <div
                          key={expense.id}
                          onClick={() => navigate(`/group/${groupId}/expense/${expense.id}`)}
                          className="card-3d p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition hover:-translate-y-0.5"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                              {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-[var(--text-primary)] line-clamp-1 tracking-tight">
                                {expense.details}
                              </h4>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                                {isPayerMe ? "You" : payer?.display_name || "Roommate"} paid •{" "}
                                {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm md:text-base font-black text-[var(--text-primary)] block tracking-tight">
                              {formatINR(expense.amount_paise)}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold ${
                                isPayerMe
                                  ? "text-indigo-600 dark:text-indigo-400"
                                  : mySplit
                                  ? "text-rose-500 dark:text-rose-400"
                                  : "text-[var(--text-muted)]"
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
                <h2 className="font-black text-base md:text-lg text-[var(--text-primary)]">Spreadsheet View</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Instant matrix view with individual shares and totals.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
              >
                Back to Feed
              </button>
            </div>

            {/* Matrix View */}
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
            <div className="card-3d p-6 md:p-8">
              <h2 className="text-base md:text-lg font-black text-[var(--text-primary)] mb-1">
                Minimal Transfers
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                Calculated to settle every roommate's balance in the fewest payments possible.
              </p>

              {simplifiedTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎉</div>
                  <h4 className="font-black text-indigo-600 dark:text-indigo-400 text-lg">All Settled Up!</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
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
                        className="card-3d p-5 flex flex-col justify-between gap-4 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span className="font-bold text-rose-500 dark:text-rose-400 text-sm">{fromName}</span>
                            <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{toName}</span>
                          </div>
                          <span className="text-3xl font-black text-[var(--text-primary)] mt-2 block tracking-tight">
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
                          className="w-full py-2.5 rounded-xl btn-3d-amber text-xs font-black flex items-center justify-center gap-1.5"
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
            <div className="card-3d p-6 md:p-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                  Flat Invite Code
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-widest">
                    {group?.invite_code || "INDORE"}
                  </span>
                  <button
                    onClick={copyCode}
                    className="btn-3d-surface p-2.5 rounded-full cursor-pointer"
                    title="Copy code"
                  >
                    {copiedCode ? (
                      <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-[var(--text-primary)]" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  Share this code with roommates so they can join and claim their spot instantly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-sm shadow-[0_4px_0_0_#15803d] active:translate-y-[3px] active:shadow-[0_1px_0_0_#15803d] transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  Share via WhatsApp
                </button>
              </div>
            </div>

            {/* Roommates List Header & Add Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-black text-sm md:text-base text-[var(--text-primary)]">
                  Roommates ({members.length})
                </h3>
                <button
                  onClick={() => setShowAddRoommate(true)}
                  className="btn-3d-indigo flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Add Roommate
                </button>
              </div>

              {/* Add Roommate Modal / Inline Card (Pure & Simple, NO Payday) */}
              {showAddRoommate && (
                <form
                  onSubmit={handleAddRoommateSubmit}
                  className="card-3d p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-[var(--text-primary)]">Add New Roommate</h4>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      They can claim this spot when they sign up!
                    </span>
                  </div>

                  {addRoommateError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{addRoommateError}</span>
                    </div>
                  )}

                  {duplicateCandidate && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        Notice: A roommate named "
                        <span className="underline">{duplicateCandidate.display_name}</span>" is
                        already in this flat. Please provide a <strong>Surname or Initial</strong> below.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
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
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#182238] border border-slate-200 dark:border-white/10 focus:border-indigo-500 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
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
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-[#182238] border rounded-xl text-xs text-[var(--text-primary)] focus:outline-none ${
                          duplicateCandidate
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 focus:border-amber-500"
                            : "border-slate-200 dark:border-white/10 focus:border-indigo-500"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRoommate(false);
                        setAddRoommateError(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="px-5 py-2 btn-3d-indigo text-xs font-black rounded-xl"
                    >
                      {addMemberMutation.isPending ? "Adding..." : "Save Roommate"}
                    </button>
                  </div>
                </form>
              )}

              {/* Responsive Roommate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="card-3d p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                        {member.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                          <span>{member.display_name}</span>
                          {member.user_id === user?.id && (
                            <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0.2 rounded-md">
                              You
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {member.user_id ? "Active member" : "Unclaimed ghost spot"}
                        </p>
                      </div>
                    </div>

                    {member.role === "admin" && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[var(--text-muted)] font-extrabold">
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
