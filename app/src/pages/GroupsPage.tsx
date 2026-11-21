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

  // Create Group Mutation
  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      // Generate clean random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: newGroup, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: name.trim(),
          invite_code: code,
          created_by: user.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin member
      const { error: memberError } = await supabase.from("members").insert({
        group_id: newGroup.id,
        user_id: user.id,
        display_name: profile?.display_name || "Admin",
        role: "admin",
      });

      if (memberError) throw memberError;
      return newGroup;
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      setIsCreating(false);
      setGroupName("");
      navigate(`/group/${newGroup.id}`);
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="px-4 py-4 bg-slate-800/80 backdrop-blur border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-lg text-white">Your Groups</h1>
          <p className="text-xs text-slate-400">
            Signed in as {profile?.display_name || "User"}
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setIsCreating(true);
              setIsJoining(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-md shadow-blue-600/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
          <button
            onClick={() => {
              setIsJoining(true);
              setIsCreating(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm active:scale-95 transition"
          >
            <KeyRound className="w-4 h-4" />
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
            className="p-4 bg-slate-800 border border-slate-700 rounded-2xl space-y-3"
          >
            <h3 className="font-semibold text-sm text-white">Create New Group</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Flat 302 Roommates"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50"
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
            className="p-4 bg-slate-800 border border-slate-700 rounded-2xl space-y-3"
          >
            <h3 className="font-semibold text-sm text-white">Enter Invite Code</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. AB12CD"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 uppercase tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsJoining(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinGroupMutation.isPending}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {joinGroupMutation.isPending ? "Joining..." : "Join"}
              </button>
            </div>
          </form>
        )}

        {/* Group List */}
        <div className="space-y-2 pt-2">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Loading groups...
            </div>
          ) : groups && groups.length > 0 ? (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(`/group/${group.id}`)}
                className="p-4 bg-slate-800/90 border border-slate-700/70 hover:border-blue-500/50 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-400 tracking-wider">
                      Code: {group.invite_code}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-dashed border-slate-800 p-6">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">No groups yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Create a group for your roommates or enter an invite code to join.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
