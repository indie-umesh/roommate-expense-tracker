import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Group, Member } from "../lib/types";
import { ChevronLeft, Share2, UserPlus, Copy, Check, AlertCircle } from "lucide-react";

export const MembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newGhostFirstName, setNewGhostFirstName] = useState("");
  const [newGhostSurname, setNewGhostSurname] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAddingGhost, setIsAddingGhost] = useState(false);
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

  // Realtime duplicate detection
  const enteredFirst = newGhostFirstName.trim().toLowerCase();
  const duplicateCandidate = members.find((m) => {
    if (!enteredFirst) return false;
    const existingFirst = m.display_name.trim().toLowerCase().split(/\s+/)[0];
    return existingFirst === enteredFirst;
  });

  // Add Ghost Member Mutation (No payday)
  const addGhostMutation = useMutation({
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
      setNewGhostFirstName("");
      setNewGhostSurname("");
      setIsAddingGhost(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to add roommate");
    },
  });

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const first = newGhostFirstName.trim();
    const surname = newGhostSurname.trim();

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
    const exactExists = members.some(
      (m) => m.display_name.trim().toLowerCase() === fullName.toLowerCase()
    );
    if (exactExists) {
      setError(`A roommate named "${fullName}" is already in this flat.`);
      return;
    }

    setError(null);
    addGhostMutation.mutate({ name: fullName });
  }

  function copyInviteCode() {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      <header className="px-4 md:px-8 py-3.5 bg-white/85 dark:bg-[#121826]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-black text-base text-[var(--text-primary)] tracking-tight">Roommates & Invite</h1>
          <div className="w-8" />
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invite Code Card */}
        <div className="card-3d p-6 md:p-8 space-y-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] font-extrabold uppercase tracking-wider">
              Group Invite Code
            </p>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-widest">
                {group?.invite_code || "------"}
              </h2>
              <button
                onClick={copyInviteCode}
                className="btn-3d-surface p-2.5 rounded-full cursor-pointer"
                title="Copy code"
              >
                {copied ? <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> : <Copy className="w-5 h-5 text-[var(--text-primary)]" />}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              Share this code so your flatmates can join with zero friction.
            </p>
          </div>

          <div>
            <button
              onClick={shareWhatsApp}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-sm shadow-[0_4px_0_0_#15803d] active:translate-y-[3px] active:shadow-[0_1px_0_0_#15803d] transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Share via WhatsApp
            </button>
          </div>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Roommates ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="btn-3d-indigo flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Roommate
            </button>
          </div>

          {/* Duplicate-safe Add Form */}
          {isAddingGhost && (
            <form
              onSubmit={handleAddMember}
              className="card-3d p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-[var(--text-primary)]">Add Roommate by Name</h4>
                <span className="text-[11px] text-[var(--text-muted)]">
                  They can claim their spot anytime when they log in!
                </span>
              </div>

              {duplicateCandidate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    A roommate named "<strong>{duplicateCandidate.display_name}</strong>" is already in this flat. Please enter their <strong>Surname or Initial</strong> to keep records distinct.
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
                    value={newGhostFirstName}
                    onChange={(e) => {
                      setNewGhostFirstName(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#182238] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                    Surname {duplicateCandidate ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma, Verma"
                    value={newGhostSurname}
                    onChange={(e) => {
                      setNewGhostSurname(e.target.value);
                      setError(null);
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-[#182238] border rounded-xl text-xs text-[var(--text-primary)] focus:outline-none ${
                      duplicateCandidate
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 focus:border-amber-500"
                        : "border-slate-200 dark:border-white/10 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGhost(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-5 py-2 btn-3d-indigo text-xs font-black rounded-xl"
                >
                  {addGhostMutation.isPending ? "Adding..." : "Save Roommate"}
                </button>
              </div>
            </form>
          )}

          {/* Roommates Grid */}
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
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      {member.display_name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {member.user_id ? "Linked to account" : "Ghost / unlinked"}
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
      </main>
    </div>
  );
};
