import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { Group } from "../lib/types";
import { Users, Plus, ArrowRight, LogOut, KeyRound, Sun, Moon } from "lucide-react";

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // If user already has a flat, redirect directly into it!
  React.useEffect(() => {
    if (groups && groups.length > 0) {
      navigate(`/group/${groups[0].id}`, { replace: true });
    }
  }, [groups, navigate]);

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
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="px-5 md:px-8 py-4 bg-white/80 dark:bg-[#121826]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between sticky top-0 z-20">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl btn-3d-indigo flex items-center justify-center text-white font-black text-sm">
              ₹
            </div>
            <div>
              <h1 className="font-black text-lg text-[var(--text-primary)] tracking-tight">
                Roommate
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Signed in as <span className="font-bold text-indigo-600 dark:text-indigo-400">{profile?.display_name || "User"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn-3d-surface p-2 rounded-full transition flex items-center justify-center cursor-pointer"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={() => signOut()}
              className="p-2 text-[var(--text-muted)] hover:text-rose-500 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 md:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 3D Action Buttons */}
        <div className="grid grid-cols-2 gap-3.5 max-w-md mx-auto">
          <button
            onClick={() => {
              setIsCreating(true);
              setIsJoining(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl btn-3d-indigo font-black text-sm"
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
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl btn-3d-surface font-extrabold text-sm"
          >
            <KeyRound className="w-4 h-4 text-indigo-500" />
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
            className="card-3d p-6 space-y-4 max-w-md mx-auto"
          >
            <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Create New Flat</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Flat 302 Roommates"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#182238] border border-slate-200 dark:border-white/10 rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="px-6 py-2 text-xs btn-3d-indigo font-black rounded-xl disabled:opacity-50"
              >
                {createGroupMutation.isPending ? "Creating..." : "Create Flat"}
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
            className="card-3d p-6 space-y-4 max-w-md mx-auto"
          >
            <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Enter Invite Code</h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. ROOM-1234"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#182238] border border-slate-200 dark:border-white/10 rounded-xl text-base text-[var(--text-primary)] placeholder-slate-400 uppercase tracking-widest text-center font-mono font-bold focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsJoining(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinGroupMutation.isPending}
                className="px-6 py-2 text-xs btn-3d-indigo font-black rounded-xl disabled:opacity-50"
              >
                {joinGroupMutation.isPending ? "Joining..." : "Join Flat"}
              </button>
            </div>
          </form>
        )}

        {/* Group List - 3D Cards in Responsive Grid */}
        <div className="pt-2">
          {isLoading ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm font-semibold">
              Loading your flats...
            </div>
          ) : groups && groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="card-3d p-5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-[var(--text-primary)] text-base tracking-tight">
                        {group.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] tracking-wider mt-0.5">
                        Code: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{group.invite_code}</span>
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-3d text-center py-12 p-6 max-w-md mx-auto">
              <Users className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3 opacity-60" />
              <p className="text-base font-extrabold text-[var(--text-primary)]">No groups yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs mx-auto">
                Create a group for your roommates or enter an invite code to join.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
