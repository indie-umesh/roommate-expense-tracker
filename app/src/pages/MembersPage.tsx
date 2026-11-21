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
        user_id: null,
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
      setError(err?.message || "Failed to add roommate");
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col">
      <header className="px-4 py-3.5 bg-white/80 backdrop-blur-md border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-1 -ml-1 text-[#86868b] hover:text-[#1d1d1f]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-base text-[#1d1d1f] tracking-tight">Roommates & Invite</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Invite Code Card */}
        <div className="p-6 bg-white border border-[#e5e5e7] rounded-[22px] space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#86868b] font-semibold uppercase tracking-wider">
                Group Invite Code
              </p>
              <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-widest mt-0.5">
                {group?.invite_code || "------"}
              </h2>
            </div>
            <button
              onClick={copyInviteCode}
              className="p-3 bg-[#f5f5f7] hover:bg-[#e5e5e7] text-[#1d1d1f] rounded-full transition"
              title="Copy code"
            >
              {copied ? <Check className="w-5 h-5 text-[#00875a]" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm shadow-sm active:scale-98 transition"
          >
            <Share2 className="w-4 h-4" />
            Share via WhatsApp
          </button>
        </div>

        {/* Members List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
              Roommates ({members.length})
            </h3>
            <button
              onClick={() => setIsAddingGhost(true)}
              className="flex items-center gap-1 text-xs text-[#0066cc] hover:underline font-semibold"
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
              className="p-4 bg-white border border-[#e5e5e7] rounded-2xl space-y-3 shadow-sm"
            >
              <p className="text-xs text-[#86868b]">
                Add Aman or Ritesh by name now. They can claim their spot when they sign up!
              </p>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Aman or Ritesh"
                value={newGhostName}
                onChange={(e) => setNewGhostName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0066cc]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGhost(false)}
                  className="px-3 py-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGhostMutation.isPending}
                  className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold rounded-full"
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
                className="p-4 bg-white border border-[#e5e5e7] rounded-2xl flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
              >
                <div>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                    {member.display_name}
                  </h4>
                  <p className="text-[11px] text-[#86868b]">
                    {member.user_id ? "Active user" : "Added (Unclaimed)"} • Role:{" "}
                    {member.role}
                  </p>
                </div>
                {member.role === "admin" && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#f0f5ff] text-[#0066cc] font-semibold">
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
