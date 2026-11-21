import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Group, Member } from "../lib/types";
import { ChevronLeft, Share2, UserPlus, Copy, Check } from "lucide-react";

export const MembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newGhostName, setNewGhostName] = useState("");
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

  // Add Ghost Member Mutation
  const addGhostMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        user_id: null, // Ghost member
        display_name: name.trim(),
        role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setNewGhostName("");
      setIsAddingGhost(false);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to add member");
    },
  });

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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-4 py-4 bg-slate-800/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-base text-white">Roommates & Invite</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Invite Code Card */}
        <div className="p-5 bg-gradient-to-br from-blue-900/40 to-slate-800 border border-blue-500/30 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
                Group Invite Code
              </p>
              <h2 className="text-2xl font-black text-white tracking-widest mt-0.5">
                {group?.invite_code || "------"}
              </h2>
            </div>
            <button
              onClick={copyInviteCode}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow transition"
              title="Copy code"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition"
          >
            <Share2 className="w-4 h-4" />
            Share via WhatsApp
          </button>
        </div>

        {/* Members List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Members ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Roommate
            </button>
          </div>

          {isAddingGhost && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newGhostName.trim()) addGhostMutation.mutate(newGhostName);
              }}
              className="p-3.5 bg-slate-800 border border-slate-700 rounded-xl space-y-2.5"
            >
              <p className="text-xs text-slate-300">
                Add by name now. They can claim this spot when they sign up later!
              </p>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Aman or Ritesh"
                value={newGhostName}
                onChange={(e) => setNewGhostName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGhost(false)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {member.display_name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {member.user_id ? "Active member" : "Added (Unclaimed)"} • Role:{" "}
                    {member.role}
                  </p>
                </div>
                {member.role === "admin" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
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
