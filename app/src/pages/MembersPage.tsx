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

  // Add Ghost Member Mutation
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
      <header className="px-4 md:px-8 py-3.5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">Roommates & Invite</h1>
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

        {/* Invite Code Card - Minimal & Clean */}
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
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
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

        {/* Members Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Roommates ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Roommate</span>
            </button>
          </div>

          {/* Duplicate-safe Add Form */}
          {isAddingGhost && (
            <form
              onSubmit={handleAddMember}
              className="card-clean p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Add Roommate by Name</h4>
                <span className="text-[11px] text-[var(--text-muted)]">
                  They can claim their spot anytime when they log in!
                </span>
              </div>

              {duplicateCandidate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    A roommate named "<strong>{duplicateCandidate.display_name}</strong>" is already in this flat. Please enter their <strong>Surname or Initial</strong> to keep records distinct.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
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
                    value={newGhostSurname}
                    onChange={(e) => {
                      setNewGhostSurname(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGhost(false);
                    setError(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-4 py-1.5 btn-primary text-xs font-medium rounded-lg shadow-xs"
                >
                  {addGhostMutation.isPending ? "Adding..." : "Add Roommate"}
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((member) => {
              const initials = member.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={member.id}
                  className="card-clean p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--text-primary)]">
                          {member.display_name}
                        </span>
                        {member.user_id && (
                          <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-[var(--text-muted)] px-1.5 py-0.2 rounded font-medium">
                            Joined
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {member.role === "admin" ? "Admin" : "Roommate"}
                      </span>
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
