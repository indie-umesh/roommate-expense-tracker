import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { formatINR } from "../lib/money";
import { simplifyDebts, calculateBalances } from "../lib/balances";
import { formatDateLocale } from "../lib/i18n";
import { localizeName } from "../lib/transliterate";
import type { Group, Member, Expense, Settlement } from "../lib/types";
import { BottomNav } from "../components/BottomNav";
import type { NavTab } from "../components/BottomNav";
import { ExcelSheetView } from "../components/ExcelSheetView";
import { AddExpenseModal } from "../components/AddExpenseModal";
import { RecordSettlementModal } from "../components/RecordSettlementModal";
import { RemoveMemberModal } from "../components/RemoveMemberModal";
import { SettingsModal } from "../components/SettingsModal";
import { BrandLogo } from "../components/BrandLogo";
import { MARKETING_HOMEPAGE_URL, getInviteUrl } from "../lib/config";
import confetti from "canvas-confetti";
import {
  Receipt,
  Share2,
  Copy,
  Link2,
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
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Phone,
  QrCode,
  FileText,
  Edit2,
  X,
  History,
  Lock,
  Globe,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";

export const GroupHomePage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>("activity");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showRecordSettlementModal, setShowRecordSettlementModal] = useState(false);
  const [settlementModalInitial, setSettlementModalInitial] = useState<{
    fromMemberId?: string;
    toMemberId?: string;
    amountPaise?: bigint;
  }>({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newRoommateFirstName, setNewRoommateFirstName] = useState("");
  const [newRoommateSurname, setNewRoommateSurname] = useState("");
  const [newRoommatePhone, setNewRoommatePhone] = useState("");
  const [newRoommateUpiId, setNewRoommateUpiId] = useState("");
  const [newRoommateNotes, setNewRoommateNotes] = useState("");
  const [showAddRoommate, setShowAddRoommate] = useState(false);
  const [addRoommateError, setAddRoommateError] = useState<string | null>(null);

  // Edit roommate state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUpiId, setEditUpiId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Delete roommate state
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [copiedUpiId, setCopiedUpiId] = useState<string | null>(null);

  // Fetch all user groups to conditionally show Switch button only when multiple flats exist
  const { data: userGroups = [] } = useQuery<Group[]>({
    queryKey: ["user-groups-count", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Group[];
    },
    enabled: !!user?.id,
  });

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

  // Add Member Mutation with Full Details
  const addMemberMutation = useMutation({
    mutationFn: async ({
      name,
      phone,
      upiId,
      notes,
    }: {
      name: string;
      phone?: string;
      upiId?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        user_id: null,
        display_name: name.trim(),
        role: "member",
        phone: phone?.trim() || null,
        upi_id: upiId?.trim() || null,
        notes: notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setNewRoommateFirstName("");
      setNewRoommateSurname("");
      setNewRoommatePhone("");
      setNewRoommateUpiId("");
      setNewRoommateNotes("");
      setShowAddRoommate(false);
      setAddRoommateError(null);
    },
    onError: (err: any) => {
      setAddRoommateError(err?.message || "Failed to add roommate");
    },
  });

  // Edit Member Mutation
  const editMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      displayName,
      phone,
      upiId,
      notes,
    }: {
      memberId: string;
      displayName: string;
      phone?: string;
      upiId?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("members")
        .update({
          display_name: displayName.trim(),
          phone: phone?.trim() || null,
          upi_id: upiId?.trim() || null,
          notes: notes?.trim() || null,
        })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setEditingMember(null);
      setAddRoommateError(null);
    },
    onError: (err: any) => {
      setAddRoommateError(err?.message || "Failed to update roommate");
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
      phone: newRoommatePhone,
      upiId: newRoommateUpiId,
      notes: newRoommateNotes,
    });
  }

  function handleStartEdit(m: Member) {
    setEditingMember(m);
    setEditDisplayName(m.display_name);
    setEditPhone(m.phone || "");
    setEditUpiId(m.upi_id || "");
    setEditNotes(m.notes || "");
    setAddRoommateError(null);
  }

  function handleEditRoommateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    if (!editDisplayName.trim()) {
      setAddRoommateError("Please enter a name.");
      return;
    }

    editMemberMutation.mutate({
      memberId: editingMember.id,
      displayName: editDisplayName,
      phone: editPhone,
      upiId: editUpiId,
      notes: editNotes,
    });
  }

  function copyUpi(upi: string) {
    navigator.clipboard.writeText(upi);
    setCopiedUpiId(upi);
    setTimeout(() => setCopiedUpiId(null), 2000);
  }

  function copyCode() {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function copyInviteLink() {
    if (group?.invite_code) {
      const url = getInviteUrl(group.invite_code);
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  function shareWhatsApp() {
    if (!group) return;
    const inviteUrl = getInviteUrl(group.invite_code);
    const text = encodeURIComponent(
      `Hey! Join our flat "${group.name}" on Roommate to split bills and track expenses together:\n\n👉 Join directly: ${inviteUrl}\n\nFlat Code: ${group.invite_code}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col pb-24 md:pb-8 w-full overflow-x-hidden transition-colors duration-200">
      {/* Top Modern App Header - Clean, Vertically Adaptive for Mobile */}
      <header className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-30 overflow-x-hidden transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Top Row */}
          <div className="h-13 md:h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Desktop Left: Logo + Flat Name */}
            <div className="hidden md:flex items-center gap-3 min-w-0">
              <a
                href={MARKETING_HOMEPAGE_URL}
                className="shrink-0 transition-transform duration-150 hover:scale-105 focus:outline-none"
                title="Return to Roommate Homepage"
              >
                <BrandLogo size={34} showText={false} />
              </a>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight truncate leading-tight">
                    {group?.name ? localizeName(group.name, currentLanguage.code) : "Indore Flat"}
                  </h1>
                  {userGroups.length > 1 && (
                    <button
                      onClick={() => navigate("/groups")}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
                      title="Switch Flat"
                    >
                      Switch
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] font-normal truncate whitespace-nowrap mt-0.5 flex items-center">
                  <span>{members.length === 1 ? t("roommate_count_one") : t("roommate_count_other", { count: members.length })}</span>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span className="truncate">
                    {t("signed_in_as")} <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{profile?.display_name ? localizeName(profile.display_name, currentLanguage.code) : "User"}</strong>
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile Left: App Logo & Brand Name */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              <a
                href={MARKETING_HOMEPAGE_URL}
                className="shrink-0 transition-transform duration-150 hover:scale-105 focus:outline-none"
                title="Return to Homepage"
              >
                <BrandLogo size={24} showText={false} />
              </a>
              <span className="font-extrabold text-xs sm:text-sm tracking-tight text-[var(--text-primary)]">
                RoomMate<span className="text-[#00966d] dark:text-[#00e599]">ExpenseTracker</span>
              </span>
            </div>

            {/* Center: Tablet / Desktop Navigation Pills */}
            <div className="hidden lg:flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/5 shrink-0">
              <button
                onClick={() => setActiveTab("activity")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "activity"
                    ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>{t("overview")}</span>
              </button>
              <button
                onClick={() => setActiveTab("sheet")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "sheet"
                    ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>{t("spreadsheet")}</span>
              </button>
              <button
                onClick={() => setActiveTab("settle")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "settle"
                    ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t("settle")}</span>
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "members"
                    ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t("roommates")}</span>
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Language Selector */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="h-8 md:h-9 px-2 sm:px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 transition cursor-pointer flex items-center gap-1 shrink-0"
                title="Settings & Language"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-tight">{currentLanguage.code}</span>
              </button>

              {/* Desktop / iPad Add Expense CTA */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="hidden md:flex h-9 items-center gap-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t("add_expense")}</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition cursor-pointer flex items-center justify-center border border-slate-200/80 dark:border-white/10 shrink-0"
                title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              >
                {theme === "light" ? (
                  <Moon className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600" />
                ) : (
                  <Sun className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
                )}
              </button>

              {/* Settings Quick Cog */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer flex items-center justify-center border border-slate-200/80 dark:border-white/10 shrink-0"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>

              {/* Logout Button (Desktop only on header - mobile has it in Settings modal) */}
              <button
                onClick={() => signOut()}
                className="hidden sm:flex w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 transition cursor-pointer items-center justify-center border border-slate-200/80 dark:border-white/10 shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Tier 2: Dedicated Full-Width Flat Identity Banner */}
          <div className="flex md:hidden items-center justify-between pt-2 pb-2.5 border-t border-slate-200/60 dark:border-white/10 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base text-[var(--text-primary)] tracking-tight leading-snug break-words">
                  {group?.name ? localizeName(group.name, currentLanguage.code) : "Indore Flat"}
                </h1>
                {userGroups.length > 1 && (
                  <button
                    onClick={() => navigate("/groups")}
                    className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                    title="Switch Flat"
                  >
                    Switch
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5 flex items-center flex-wrap gap-1">
                <span>{members.length === 1 ? t("roommate_count_one") : t("roommate_count_other", { count: members.length })}</span>
                <span className="opacity-40">·</span>
                <span className="truncate">
                  {t("signed_in_as")} <strong className="text-[#00966d] dark:text-[#00e599] font-semibold">{profile?.display_name ? localizeName(profile.display_name, currentLanguage.code) : "User"}</strong>
                </span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Sections based on Active Tab */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-4xl lg:max-w-6xl xl:max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: ACTIVITY / OVERVIEW DASHBOARD */}
        {activeTab === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Multi-column Grid on Tablet & Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left Column: Net Status & Financial Summary (span 5 on md/lg) */}
              <div className="md:col-span-5 space-y-4">
                {/* Clean Modern Net Balance Card */}
                <div className="card-clean p-6 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("net_balance")}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      myBalance > 0n
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : myBalance < 0n
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-slate-100 dark:bg-white/5 text-[var(--text-muted)]"
                    }`}>
                      {myBalance > 0n
                        ? t("you_get_back")
                        : myBalance < 0n
                        ? t("you_owe")
                        : t("all_settled_up")}
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
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">
                      {myBalance > 0n
                        ? t("flat_owes_them", { amount: formatINR(myBalance) })
                        : myBalance < 0n
                        ? t("owes_flat", { amount: formatINR(-myBalance) })
                        : t("zero_debt")}
                    </p>
                  </div>

                  {/* Settlement Summary in Plain Words */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t("what_flatmates_owe")}
                      </span>
                      <button
                        onClick={() => setActiveTab("settle")}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                      >
                        {t("settle")} →
                      </button>
                    </div>

                    {simplifiedTransfers.length === 0 ? (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        ✓ {t("all_debts_cleared")}
                      </p>
                    ) : (
                      simplifiedTransfers.slice(0, 3).map((tItem, idx) => {
                        const fromM = memberMap.get(tItem.fromMemberId);
                        const toM = memberMap.get(tItem.toMemberId);
                        const fromName = fromM ? (fromM.user_id === user?.id ? t("you") : localizeName(fromM.display_name, currentLanguage.code)) : "Someone";
                        const toName = toM ? (toM.user_id === user?.id ? t("you") : localizeName(toM.display_name, currentLanguage.code)) : "Someone";
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1"
                          >
                            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
                              <span className="font-semibold text-rose-500 dark:text-rose-400">{fromName}</span>
                              <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{toName}</span>
                            </div>
                            <span className="font-bold text-[var(--text-primary)]">
                              {formatINR(tItem.amountPaise)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Flat Snapshot Overview Card */}
                <div className="card-clean p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {t("overview")}
                    </span>
                    <button
                      onClick={() => setActiveTab("members")}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      {t("roommates")} ({members.length}) →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase block">{t("total_spent")}</span>
                      <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {formatINR(totalGroupSpent)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase block">{t("sheet")}</span>
                      <span className="text-base font-bold text-[var(--text-primary)] block mt-0.5">
                        {expenses.length}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={shareWhatsApp}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {t("share_whatsapp")}
                  </button>
                </div>
              </div>

              {/* Right Column: Recent Expenses Feed (span 7 on md/lg) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)]">
                    {t("recent_activity")} ({expenses.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("sheet")}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    <Table className="w-3.5 h-3.5" />
                    {t("spreadsheet")} →
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div className="card-clean text-center py-12 p-6">
                    <Receipt className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{t("no_expenses_yet")}</p>
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
                          className="card-clean p-4 flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                              {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1 tracking-tight">
                                {expense.details}
                              </h4>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                                {isPayerMe ? t("you") : payer ? localizeName(payer.display_name, currentLanguage.code) : t("roommates")} {t("paid_by")} •{" "}
                                {formatDateLocale(expense.spent_on, currentLanguage.code, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm md:text-base font-bold text-[var(--text-primary)] block tracking-tight">
                              {formatINR(expense.amount_paise)}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                isPayerMe
                                  ? "text-indigo-600 dark:text-indigo-400"
                                  : mySplit
                                  ? "text-rose-500 dark:text-rose-400"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {isPayerMe
                                ? `+${formatINR(
                                    expense.amount_paise - (mySplit?.share_paise || 0n)
                                  )}`
                                : mySplit
                                ? formatINR(mySplit.share_paise)
                                : "–"}
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
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-bold text-base md:text-lg text-[var(--text-primary)]">{t("spreadsheet")}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {t("spreadsheet_desc")}
                </p>
              </div>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                {t("back_to_feed")}
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

        {/* TAB 3: SETTLE UP (MINIMAL TRANSFERS & PAYMENTS) */}
        {activeTab === "settle" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="card-clean p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
                    {t("optimal_settle_plan")}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {t("optimal_settle_desc")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSettlementModalInitial({});
                    setShowRecordSettlementModal(true);
                  }}
                  className="btn-primary py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t("record_payment")}</span>
                </button>
              </div>

              {simplifiedTransfers.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🎉</div>
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{t("all_settled_up")}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                    {t("all_debts_cleared")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {simplifiedTransfers.map((tItem, idx) => {
                    const fromM = memberMap.get(tItem.fromMemberId);
                    const toM = memberMap.get(tItem.toMemberId);
                    const fromName = fromM ? (fromM.user_id === user?.id ? t("you") : localizeName(fromM.display_name, currentLanguage.code)) : "Someone";
                    const toName = toM ? (toM.user_id === user?.id ? t("you") : localizeName(toM.display_name, currentLanguage.code)) : "Someone";

                    return (
                      <div
                        key={idx}
                        className="card-clean p-5 flex flex-col justify-between gap-4 transition border border-slate-200/80 dark:border-white/10"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span className="font-semibold text-rose-500 dark:text-rose-400 text-sm">{fromName}</span>
                            <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">{toName}</span>
                          </div>
                          <span className="text-3xl font-extrabold text-[var(--text-primary)] mt-2 block tracking-tight">
                            {formatINR(tItem.amountPaise)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={() =>
                              recordSettlementMutation.mutate({
                                fromMemberId: tItem.fromMemberId,
                                toMemberId: tItem.toMemberId,
                                amountPaise: tItem.amountPaise,
                              })
                            }
                            disabled={recordSettlementMutation.isPending}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t("mark_as_paid")}
                          </button>

                          <button
                            onClick={() => {
                              setSettlementModalInitial({
                                fromMemberId: tItem.fromMemberId,
                                toMemberId: tItem.toMemberId,
                                amountPaise: tItem.amountPaise,
                              });
                              setShowRecordSettlementModal(true);
                            }}
                            className="w-full py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                          >
                            {t("custom_amount_note")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="card-clean p-6 md:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)]">
                    {t("payment_history", { count: settlements.length })}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSettlementModalInitial({});
                    setShowRecordSettlementModal(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("record_payment")}</span>
                </button>
              </div>

              {settlements.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                  {t("no_payments_yet")}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {settlements.map((s) => {
                    const from = memberMap.get(s.from_member_id);
                    const to = memberMap.get(s.to_member_id);
                    return (
                      <div
                        key={s.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                            <span className="font-semibold text-rose-500 dark:text-rose-400">
                              {from ? (from.user_id === user?.id ? t("you") : localizeName(from.display_name, currentLanguage.code)) : t("roommates")}
                            </span>
                            <span className="text-[var(--text-muted)]">{t("pays")}</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {to ? (to.user_id === user?.id ? t("you") : localizeName(to.display_name, currentLanguage.code)) : t("roommates")}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {formatDateLocale(s.settled_on, currentLanguage.code, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {s.note && (
                              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium border border-indigo-200/50 dark:border-indigo-800/40">
                                💬 {s.note}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-[var(--text-primary)]">
                          {formatINR(s.amount_paise)}
                        </span>
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
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Flat Invite Banner */}
            <div className="card-clean p-6 md:p-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t("invite_code")}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-widest">
                    {group?.invite_code || "INDORE"}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition cursor-pointer"
                    title={t("copied")}
                  >
                    {copiedCode ? (
                      <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-[var(--text-primary)]" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  {t("share_whatsapp_desc")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyInviteLink}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] font-semibold text-xs shadow-xs transition active:scale-[0.98] cursor-pointer"
                  title="Copy direct invite link"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">{t("copied")} Link</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 opacity-70" />
                      <span>Copy Joining Link</span>
                    </>
                  )}
                </button>
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  {t("share_whatsapp")}
                </button>
              </div>
            </div>

            {/* Roommates List Header & Add Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)]">
                  {t("flat_roommates", { count: members.length })}
                </h3>
                <button
                  onClick={() => setShowAddRoommate(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + {t("add_roommate")}
                </button>
              </div>

              {/* Add Roommate Modal / Inline Card */}
              {showAddRoommate && (
                <form
                  onSubmit={handleAddRoommateSubmit}
                  className="card-clean p-5 space-y-4 border-indigo-200 dark:border-indigo-800/40"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{t("add_roommate_details")}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRoommate(false);
                        setAddRoommateError(null);
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
                        {t("duplicate_roommate_warning", { name: localizeName(duplicateCandidate.display_name, currentLanguage.code) })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        {t("first_name")}
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Aman, Umesh"
                        value={newRoommateFirstName}
                        onChange={(e) => {
                          setNewRoommateFirstName(e.target.value);
                          setAddRoommateError(null);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-indigo-500 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        {t("surname")}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sharma, Verma"
                        value={newRoommateSurname}
                        onChange={(e) => {
                          setNewRoommateSurname(e.target.value);
                          setAddRoommateError(null);
                        }}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs text-[var(--text-primary)] focus:outline-none ${
                          duplicateCandidate
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 focus:border-amber-500"
                            : "border-slate-200 dark:border-white/10 focus:border-indigo-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("mobile_number")}</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={newRoommatePhone}
                        onChange={(e) => setNewRoommatePhone(e.target.value.replace(/\D/g, ""))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("upi_id")}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. name@okhdfcbank"
                        value={newRoommateUpiId}
                        onChange={(e) => setNewRoommateUpiId(e.target.value.trim().toLowerCase())}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("room_notes")}</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t("room_notes_placeholder")}
                        value={newRoommateNotes}
                        onChange={(e) => setNewRoommateNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRoommate(false);
                        setAddRoommateError(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
                    >
                      {addMemberMutation.isPending ? t("loading") : t("save_roommate")}
                    </button>
                  </div>
                </form>
              )}

              {/* Edit Roommate Inline Modal/Card */}
              {editingMember && (
                <form
                  onSubmit={handleEditRoommateSubmit}
                  className="card-clean p-5 space-y-4 border-indigo-300 dark:border-indigo-700/60"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{t("edit_roommate_details")}</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">{t("manage_roommates_desc")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        {t("full_name")}
                      </label>
                      <input
                        type="text"
                        required
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("mobile_number")}</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ""))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("upi_id")}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. name@oksbi"
                        value={editUpiId}
                        onChange={(e) => setEditUpiId(e.target.value.trim().toLowerCase())}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{t("room_notes")}</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t("room_notes_placeholder")}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={editMemberMutation.isPending}
                      className="px-4 py-1.5 btn-primary text-xs font-medium rounded-lg shadow-xs"
                    >
                      {editMemberMutation.isPending ? t("loading") : t("update_details")}
                    </button>
                  </div>
                </form>
              )}

              {/* Customized Beimaani-Proof Delete Roommate Confirmation Modal */}
              <RemoveMemberModal
                isOpen={!!deletingMember}
                onClose={() => setDeletingMember(null)}
                member={deletingMember}
                groupId={groupId!}
                balances={balances}
                expenses={expenses}
                onGoToSettleUp={() => setActiveTab("settle")}
              />

              {/* Responsive Roommate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {members.map((member) => {
                  const bal = balances.find((b) => b.memberId === member.id)?.netPaise ?? 0n;
                  const hasBills = expenses.some(
                    (e) =>
                      e.paid_by_member_id === member.id ||
                      e.splits?.some((s) => s.member_id === member.id)
                  );
                  const isLocked = bal !== 0n || hasBills;

                  return (
                    <div
                      key={member.id}
                      className="card-clean p-4 flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-white/20 transition"
                    >
                      <div>
                        {/* Top Row: Avatar + Name + Badges + Actions */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {currentLanguage.code === "hi"
                                ? localizeName(member.display_name, currentLanguage.code).slice(0, 2)
                                : member.display_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-1.5 flex-wrap">
                                <span>{localizeName(member.display_name, currentLanguage.code)}</span>
                                {member.user_id === user?.id && (
                                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0.2 rounded-md">
                                    {t("you")}
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                {member.role === "admin" ? t("admin") : t("roommates")} • {member.user_id ? t("active_member") : t("unclaimed_spot")}
                              </p>

                              {/* Financial Dues & Settlement Status Badge */}
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {bal !== 0n ? (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                    bal > 0n
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                                  }`}>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>{bal > 0n ? t("flat_owes_them", { amount: formatINR(bal) }) : t("owes_flat", { amount: formatINR(-bal) })}</span>
                                  </span>
                                ) : hasBills ? (
                                  <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>{t("active_member")}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                                    ✓ {t("zero_debt")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Menu: Edit & Delete */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(member)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition cursor-pointer"
                              title={t("edit")}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingMember(member)}
                              className={`p-1.5 rounded-md transition cursor-pointer ${
                                isLocked
                                  ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              }`}
                              title={isLocked ? t("removal_blocked") : t("delete")}
                            >
                              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                      {/* Roommate Details Section (Phone, UPI, Notes) */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-1.5">
                        {member.phone ? (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <a
                              href={`tel:${member.phone}`}
                              className="hover:underline text-[var(--text-primary)] font-medium"
                            >
                              +91 {member.phone}
                            </a>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 dark:text-slate-600 italic">
                            {t("no_phone")}
                          </div>
                        )}

                        {member.upi_id && (
                          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] bg-slate-50 dark:bg-white/5 p-1.5 px-2 rounded-lg">
                            <div className="flex items-center gap-1.5 truncate">
                              <CreditCard className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="font-mono text-[11px] text-[var(--text-primary)] truncate">
                                {member.upi_id}
                              </span>
                            </div>
                            <button
                              onClick={() => copyUpi(member.upi_id!)}
                              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shrink-0"
                              title={t("copy_upi")}
                            >
                              {copiedUpiId === member.upi_id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        )}

                        {member.notes && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{member.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* Quick Add Expense Modal */}
      <AddExpenseModal
        groupId={groupId!}
        members={members}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Record Settlement & Reimbursement Modal */}
      <RecordSettlementModal
        groupId={groupId!}
        members={members}
        isOpen={showRecordSettlementModal}
        onClose={() => setShowRecordSettlementModal(false)}
        initialFromMemberId={settlementModalInitial.fromMemberId}
        initialToMemberId={settlementModalInitial.toMemberId}
        initialAmountPaise={settlementModalInitial.amountPaise}
      />

      {/* Settings & Language Switcher Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
