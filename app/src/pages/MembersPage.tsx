import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Group, Member } from "../lib/types";
import { ChevronLeft, Share2, UserPlus, Copy, Check, Calendar, AlertCircle } from "lucide-react";

export const MembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newGhostFirstName, setNewGhostFirstName] = useState("");
  const [newGhostSurname, setNewGhostSurname] = useState("");
  const [newGhostPayday, setNewGhostPayday] = useState<string>("");
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
      setNewGhostFirstName("");
      setNewGhostSurname("");
      setNewGhostPayday("");
      setIsAddingGhost(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to add roommate");
    },
  });

  // Update Payday Mutation
  const updatePaydayMutation = useMutation({
    mutationFn: async ({ memberId, payday }: { memberId: string; payday: number }) => {
      const { error } = await supabase
        .from("members")
        .update({ payday_day: payday })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
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
    addGhostMutation.mutate({
      name: fullName,
      payday: newGhostPayday ? parseInt(newGhostPayday, 10) : null,
    });
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
      `Hey! Join our roommate expense tracker group "${group.name}". Use invite code: ${group.invite_code} or visit https://app.roommatesexpensemanager.com`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col">
      <header className="px-4 md:px-8 py-3.5 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-base text-white tracking-tight">Roommates & Invite</h1>
          <div className="w-8" />
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invite Code Card */}
        <div className="p-6 md:p-8 bg-[#121826] border border-white/10 rounded-[28px] space-y-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Group Invite Code
            </p>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-3xl md:text-4xl font-black text-emerald-400 tracking-widest">
                {group?.invite_code || "------"}
              </h2>
              <button
                onClick={copyInviteCode}
                className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition cursor-pointer border border-white/10"
                title="Copy code"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Share this code so your flatmates can join with zero friction.
            </p>
          </div>

          <div>
            <button
              onClick={shareWhatsApp}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-md active:scale-98 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Share via WhatsApp
            </button>
          </div>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Roommates ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Roommate
            </button>
          </div>

          {/* Duplicate-safe Add Form */}
          {isAddingGhost && (
            <form
              onSubmit={handleAddMember}
              className="p-5 bg-[#121826] border-2 border-emerald-500/40 rounded-2xl space-y-3.5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">Add Roommate by Name</h4>
                <span className="text-[11px] text-slate-400">
                  They can claim their spot anytime when they log in!
                </span>
              </div>

              {duplicateCandidate && (
                <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    A roommate named "<strong>{duplicateCandidate.display_name}</strong>" is already in this flat. Please enter their <strong>Surname or Initial</strong> to keep records distinct.
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
                    value={newGhostFirstName}
                    onChange={(e) => setNewGhostFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#182238] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Surname / Initial {duplicateCandidate ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma, G."
                    value={newGhostSurname}
                    onChange={(e) => setNewGhostSurname(e.target.value)}
                    className={`w-full px-3 py-2 bg-[#182238] border rounded-xl text-xs text-white focus:outline-none ${
                      duplicateCandidate
                        ? "border-amber-400 bg-amber-950/20 focus:border-amber-500"
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
                    value={newGhostPayday}
                    onChange={(e) => setNewGhostPayday(e.target.value)}
                    className="w-full px-3 py-2 bg-[#182238] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 text-xs font-black rounded-full shadow-md transition active:scale-95 cursor-pointer"
                >
                  {addGhostMutation.isPending ? "Adding..." : "Add Roommate"}
                </button>
              </div>
            </form>
          )}

          {/* Responsive Roommate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-[#121826] border border-white/10 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between shadow-md transition"
              >
                <div>
                  <h4 className="font-bold text-sm text-white tracking-tight">
                    {member.display_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>{member.user_id ? "Active user" : "Added (Unclaimed)"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      {member.payday_day ? `Payday: ${member.payday_day}th` : "No payday set"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={member.payday_day || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= 31) {
                        updatePaydayMutation.mutate({ memberId: member.id, payday: val });
                      }
                    }}
                    className="px-2.5 py-1 text-xs border border-white/10 rounded-xl bg-[#182238] text-white focus:outline-none focus:border-emerald-500"
                    title="Set salary payday"
                  >
                    <option value="">Payday...</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}th
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
