import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../lib/money";
import { calculateBalances } from "../lib/balances";
import type { Group, Member, Expense, Settlement } from "../lib/types";
import { RemoveMemberModal } from "../components/RemoveMemberModal";
import { SettingsModal } from "../components/SettingsModal";
import { useLanguage } from "../context/LanguageContext";
import {
  ChevronLeft,
  Share2,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Phone,
  QrCode,
  FileText,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Lock,
  Globe,
} from "lucide-react";

export const MembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Add roommate state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newUpiId, setNewUpiId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit roommate state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUpiId, setEditUpiId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Delete roommate state
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUpiId, setCopiedUpiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch group
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

  // Fetch active expenses with splits for balance & settlement lock checks
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

  // Fetch settlements for balance calculations
  const { data: settlements = [] } = useQuery<Settlement[]>({
    queryKey: ["group-settlements", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        amount_paise: s.amount_paise ? BigInt(String(s.amount_paise).split(".")[0]) : 0n,
      }));
    },
    enabled: !!groupId,
  });

  const balances = calculateBalances(
    members.map((m) => m.id),
    expenses,
    settlements
  );

  // Realtime duplicate detection for add
  const enteredFirst = newFirstName.trim().toLowerCase();
  const duplicateCandidate = members.find((m) => {
    if (!enteredFirst) return false;
    const existingFirst = m.display_name.trim().toLowerCase().split(/\s+/)[0];
    return existingFirst === enteredFirst;
  });

  // Add Member Mutation
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
      setNewFirstName("");
      setNewSurname("");
      setNewPhone("");
      setNewUpiId("");
      setNewNotes("");
      setIsAddingMember(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to add roommate");
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
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to update roommate details");
    },
  });

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const first = newFirstName.trim();
    const surname = newSurname.trim();

    if (!first) {
      setError("Please enter a first name.");
      return;
    }

    if (duplicateCandidate && !surname) {
      setError(
        `A roommate named "${duplicateCandidate.display_name}" already exists! Please add a surname or initial to tell them apart.`
      );
      return;
    }

    const fullName = surname ? `${first} ${surname}` : first;
    setError(null);
    addMemberMutation.mutate({
      name: fullName,
      phone: newPhone,
      upiId: newUpiId,
      notes: newNotes,
    });
  }

  function handleStartEdit(m: Member) {
    setEditingMember(m);
    setEditDisplayName(m.display_name);
    setEditPhone(m.phone || "");
    setEditUpiId(m.upi_id || "");
    setEditNotes(m.notes || "");
    setError(null);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    if (!editDisplayName.trim()) {
      setError("Please enter a name.");
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

  function copyInviteCode() {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function copyUpi(upi: string) {
    navigator.clipboard.writeText(upi);
    setCopiedUpiId(upi);
    setTimeout(() => setCopiedUpiId(null), 2000);
  }

  function shareWhatsApp() {
    if (!group) return;
    const text = encodeURIComponent(
      `Hey! Join our flat on Roommate. Use invite code: ${group.invite_code} or visit https://app.roommatesexpensemanager.com`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col transition-colors duration-200">
      <header className="h-16 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-10 transition-all">
        <div className="max-w-5xl h-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">{t("roommates")}</h1>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 transition cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Settings & Language"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold uppercase">{currentLanguage.code}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invite Code Card */}
        <div className="card-clean p-6 md:p-7 space-y-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              {t("invite_code")}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider">
                {group?.invite_code || "------"}
              </h2>
              <button
                onClick={copyInviteCode}
                className="btn-surface p-2 rounded-lg cursor-pointer"
                title={t("copied")}
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-normal">
              {t("share_whatsapp_desc")}
            </p>
          </div>

          <div>
            <button
              onClick={shareWhatsApp}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              <span>{t("share_whatsapp")}</span>
            </button>
          </div>
        </div>

        {/* Members Header */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {t("flat_roommates", { count: members.length })}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {t("manage_roommates_desc")}
              </p>
            </div>
            <button
              onClick={() => {
                setIsAddingMember(true);
                setEditingMember(null);
                setError(null);
              }}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t("add_roommate")}</span>
            </button>
          </div>

          {/* Add Roommate Modal / Expandable Card */}
          {isAddingMember && (
            <form
              onSubmit={handleAddSubmit}
              className="card-clean p-5 space-y-4 border-indigo-200 dark:border-indigo-800/40"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                <h4 className="font-bold text-sm text-[var(--text-primary)]">{t("add_roommate_details")}</h4>
                <button
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {duplicateCandidate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    A roommate named "<strong>{duplicateCandidate.display_name}</strong>" is already in this flat. Please enter a <strong>Surname or Initial</strong> to keep records distinct.
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
                    value={newFirstName}
                    onChange={(e) => {
                      setNewFirstName(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    {t("surname")}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma, Verma"
                    value={newSurname}
                    onChange={(e) => {
                      setNewSurname(e.target.value);
                      setError(null);
                    }}
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
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
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
                    value={newUpiId}
                    onChange={(e) => setNewUpiId(e.target.value.trim().toLowerCase())}
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
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="px-4 py-1.5 btn-primary text-xs font-medium rounded-lg shadow-xs"
                >
                  {addMemberMutation.isPending ? t("loading") : t("save_roommate")}
                </button>
              </div>
            </form>
          )}

          {/* Edit Roommate Modal */}
          {editingMember && (
            <form
              onSubmit={handleEditSubmit}
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
            onGoToSettleUp={() => navigate(`/group/${groupId}/settle`)}
          />

          {/* Roommates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {members.map((member) => {
              const initials = member.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const isMe = member.user_id === user?.id;

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
                    {/* Top Row: Avatar + Name + Badges */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">
                              {member.display_name}
                            </h4>
                            {isMe && (
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] block">
                            {member.role === "admin" ? "Admin" : "Roommate"} • {member.user_id ? "Active" : "Unclaimed"}
                          </span>

                          {/* Financial Dues & Settlement Status Badge */}
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {bal !== 0n ? (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                bal > 0n
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                              }`}>
                                <Lock className="w-2.5 h-2.5" />
                                <span>{bal > 0n ? `Flat owes ${formatINR(bal)}` : `Owes ${formatINR(-bal)}`}</span>
                              </span>
                            ) : hasBills ? (
                              <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Active in ledger</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                                ✓ Settled (₹0)
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
                            <CreditCard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
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
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
