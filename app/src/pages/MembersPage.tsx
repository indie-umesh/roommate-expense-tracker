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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col">
      <header className="px-4 md:px-8 py-3.5 bg-white/80 backdrop-blur-md border-b border-[#e5e5e7] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="p-1.5 -ml-1 text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f0f0f2] rounded-full transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-base text-[#1d1d1f] tracking-tight">Roommates & Invite</h1>
          <div className="w-8" />
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invite Code Card */}
        <div className="p-6 md:p-8 bg-white border border-[#e5e5e7] rounded-[24px] space-y-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#86868b] font-semibold uppercase tracking-wider">
              Group Invite Code
            </p>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-3xl md:text-4xl font-black text-[#1d1d1f] tracking-widest">
                {group?.invite_code || "------"}
              </h2>
              <button
                onClick={copyInviteCode}
                className="p-2.5 bg-[#f5f5f7] hover:bg-[#e5e5e7] text-[#1d1d1f] rounded-full transition cursor-pointer"
                title="Copy code"
              >
                {copied ? <Check className="w-5 h-5 text-[#00875a]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-[#86868b] mt-1">
              Share this code so your flatmates can join with zero hassle.
            </p>
          </div>

          <div>
            <button
              onClick={shareWhatsApp}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm shadow-sm active:scale-98 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Share via WhatsApp
            </button>
          </div>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
              Roommates ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f5ff] hover:bg-[#e1edff] text-[#0066cc] rounded-full text-xs font-semibold transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Roommate
            </button>
          </div>

          {/* Duplicate-safe Add Form */}
          {isAddingGhost && (
            <form
              onSubmit={handleAddMember}
              className="p-5 bg-white border-2 border-[#0066cc]/30 rounded-2xl space-y-3.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#1d1d1f]">Add Roommate by Name</h4>
                <span className="text-[11px] text-[#86868b]">
                  They can claim their spot anytime when they log in!
                </span>
              </div>

              {duplicateCandidate && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    A roommate named "<strong>{duplicateCandidate.display_name}</strong>" is already in this flat. Please enter their <strong>Surname or Initial</strong> to keep records distinct.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Aman, Ritesh"
                    value={newGhostFirstName}
                    onChange={(e) => setNewGhostFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                    Surname / Initial {duplicateCandidate ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma, G."
                    value={newGhostSurname}
                    onChange={(e) => setNewGhostSurname(e.target.value)}
                    className={`w-full px-3 py-2 bg-[#fbfbfd] border rounded-xl text-xs text-[#1d1d1f] focus:outline-none ${
                      duplicateCandidate
                        ? "border-amber-400 bg-amber-50/20 focus:border-amber-600"
                        : "border-[#d2d2d7] focus:border-[#0066cc]"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                    Salary / Payday (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 1st, 5th, 15th"
                    value={newGhostPayday}
                    onChange={(e) => setNewGhostPayday(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
                  className="px-4 py-2 text-xs text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-5 py-2 bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold rounded-full shadow-sm transition active:scale-95 cursor-pointer"
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
                className="p-4 bg-white border border-[#e5e5e7] hover:border-[#0066cc]/40 rounded-2xl flex items-center justify-between shadow-2xs transition"
              >
                <div>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                    {member.display_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#86868b]">
                    <span>{member.user_id ? "Active user" : "Added (Unclaimed)"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium text-[#1d1d1f]">
                      <Calendar className="w-3 h-3 text-[#0066cc]" />
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
                    className="px-2.5 py-1 text-xs border border-[#d2d2d7] rounded-xl bg-[#fbfbfd] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
