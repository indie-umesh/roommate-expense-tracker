import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Group } from "../lib/types";
import { Users, Plus, ArrowRight, LogOut, KeyRound } from "lucide-react";

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch groups that caller is a member of
  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["user-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Create Group Mutation via atomic RPC
  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc("create_group", {
        p_name: name.trim(),
      });
      if (error) throw error;
      return data as string; // returns new group_id
    },
    onSuccess: (newGroupId) => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      setIsCreating(false);
      setGroupName("");
      navigate(`/group/${newGroupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create group");
    },
  });

  // Join Group Mutation
  const joinGroupMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("join_group", {
        p_invite_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      return data as string; // group_id
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      setIsJoining(false);
      setInviteCode("");
      navigate(`/group/${groupId}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Invalid invite code or failed to join");
    },
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col">
      {/* Top Header */}
      <header className="px-5 md:px-8 py-4 bg-[#121826]/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between sticky top-0 z-10">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg text-white tracking-tight flex items-center gap-2">
              <span className="text-emerald-400">⚡</span> Roommate
            </h1>
            <p className="text-xs text-slate-400">
              Signed in as <span className="font-bold text-emerald-400">{profile?.display_name || "User"}</span>
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-5 md:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-5">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            onClick={() => {
              setIsCreating(true);
              setIsJoining(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-md active:scale-98 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Group
          </button>
          <button
            onClick={() => {
              setIsJoining(true);
              setIsCreating(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#121826] hover:bg-white/10 text-white border border-white/10 font-bold text-sm active:scale-98 transition shadow-sm cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            Join Code
          </button>
        </div>

        {/* Modal: Create Group */}
        {isCreating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (groupName.trim()) createGroupMutation.mutate(groupName);
            }}
            className="p-5 bg-[#121826] border border-white/10 rounded-2xl space-y-3.5 shadow-xl max-w-md mx-auto"
          >
            <h3 className="font-bold text-sm text-white">Create New Group</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Flat 302 Roommates"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-full disabled:opacity-50 cursor-pointer"
              >
                {createGroupMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}

        {/* Modal: Join Group */}
        {isJoining && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteCode.trim()) joinGroupMutation.mutate(inviteCode);
            }}
            className="p-5 bg-[#121826] border border-white/10 rounded-2xl space-y-3.5 shadow-xl max-w-md mx-auto"
          >
            <h3 className="font-bold text-sm text-white">Enter Invite Code</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. ROOM-1234"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-[#182238] border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 uppercase tracking-widest text-center focus:outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsJoining(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinGroupMutation.isPending}
                className="px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-full disabled:opacity-50 cursor-pointer"
              >
                {joinGroupMutation.isPending ? "Joining..." : "Join"}
              </button>
            </div>
          </form>
        )}

        {/* Group List - Responsive Grid on Tablet / Desktop */}
        <div className="pt-2">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Loading groups...
            </div>
          ) : groups && groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="p-4 md:p-5 bg-[#121826] border border-white/10 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base tracking-tight">
                        {group.name}
                      </h3>
                      <p className="text-xs text-slate-400 tracking-wider mt-0.5">
                        Invite code: <span className="font-bold text-emerald-400">{group.invite_code}</span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#121826] rounded-2xl border border-dashed border-white/10 p-6 max-w-md mx-auto">
              <Users className="w-10 h-10 mx-auto text-slate-500 mb-2.5 opacity-60" />
              <p className="text-sm font-bold text-white">No groups yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Create a group for your roommates or enter an invite code to join.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
