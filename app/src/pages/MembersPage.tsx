import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Group, Member } from "../lib/types";
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
} from "lucide-react";

export const MembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // Delete Member Mutation via atomic remove_member RPC
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.rpc("remove_member", {
        p_member_id: memberId,
      });
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || "Cannot remove roommate");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      setDeletingMember(null);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to remove roommate");
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
      <header className="px-4 md:px-8 py-3.5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">Roommates & Details</h1>
          <div className="w-8" />
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
              Flat Invite Code
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider">
                {group?.invite_code || "------"}
              </h2>
              <button
                onClick={copyInviteCode}
                className="btn-surface p-2 rounded-lg cursor-pointer"
                title="Copy code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-normal">
              Share this code so your flatmates can join with zero friction.
            </p>
          </div>

          <div>
            <button
              onClick={shareWhatsApp}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              <span>Share via WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Members Header */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Flat Roommates ({members.length})
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Manage roommate profiles, phone numbers, UPI IDs, and room notes.
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
              <span>Add Roommate</span>
            </button>
          </div>

          {/* Add Roommate Modal / Expandable Card */}
          {isAddingMember && (
            <form
              onSubmit={handleAddSubmit}
              className="card-clean p-5 space-y-4 border-indigo-200 dark:border-indigo-800/40"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                <h4 className="font-bold text-sm text-[var(--text-primary)]">Add Roommate Details</h4>
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
                    First Name *
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
                    Surname {duplicateCandidate ? "(Required)" : "(Optional)"}
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
                    <span>Mobile Number (Optional)</span>
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
                    <span>UPI ID / VPA (Optional)</span>
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
                    <span>Room / Notes (Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Master Bedroom, Room 201"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="px-4 py-1.5 btn-primary text-xs font-medium rounded-lg shadow-xs"
                >
                  {addMemberMutation.isPending ? "Adding..." : "Save Roommate"}
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
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Edit Roommate Details</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Update name, phone number, UPI ID, or room notes.</p>
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
                    Full Name *
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
                    <span>Mobile Number</span>
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
                    <span>UPI ID / VPA</span>
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
                    <span>Room / Notes</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Master Bedroom"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMemberMutation.isPending}
                  className="px-4 py-1.5 btn-primary text-xs font-medium rounded-lg shadow-xs"
                >
                  {editMemberMutation.isPending ? "Saving..." : "Update Details"}
                </button>
              </div>
            </form>
          )}

          {/* Delete Confirmation Alert Modal */}
          {deletingMember && (
            <div className="card-clean p-5 border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Remove Roommate: {deletingMember.display_name}?</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Are you sure you want to remove <strong>{deletingMember.display_name}</strong> from this flat? Roommates with logged expenses or splits cannot be removed until their expenses are settled.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingMember(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMemberMutation.mutate(deletingMember.id)}
                  disabled={deleteMemberMutation.isPending}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {deleteMemberMutation.isPending ? "Removing..." : "Yes, Remove"}
                </button>
              </div>
            </div>
          )}

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
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">
                              {member.display_name}
                            </h4>
                            {isMe && (
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {member.role === "admin" ? "Admin" : "Roommate"} • {member.user_id ? "Active" : "Unclaimed"}
                          </span>
                        </div>
                      </div>

                      {/* Action Menu: Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(member)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition cursor-pointer"
                          title="Edit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingMember(member)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                          title="Remove roommate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                          No phone number added
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
                            title="Copy UPI ID"
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
    </div>
  );
};
