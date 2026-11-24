import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { SettingsModal } from "../components/SettingsModal";
import { BrandLogo } from "../components/BrandLogo";
import { MARKETING_HOMEPAGE_URL } from "../lib/config";
import { localizeName } from "../lib/transliterate";
import type { Group } from "../lib/types";
import { Users, Plus, ArrowRight, LogOut, KeyRound, Sun, Moon, Globe } from "lucide-react";

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      <header className="h-16 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 flex items-center sticky top-0 z-20 transition-all">
        <div className="max-w-5xl mx-auto w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a
            href={MARKETING_HOMEPAGE_URL}
            className="flex items-center gap-3 group focus:outline-none"
            title="Return to Homepage"
          >
            <BrandLogo size={34} showText={false} />
            <div>
              <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight leading-tight group-hover:text-[#00966d] dark:group-hover:text-[#00e599] transition">
                Roommate
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5">
                {t("signed_in_as")}{" "}
                <span className="font-medium text-[#00966d] dark:text-[#00e599]">
                  {profile?.display_name ? localizeName(profile.display_name, currentLanguage.code) : "User"}
                </span>
              </p>
            </div>
          </a>

          <div className="flex items-center gap-2">
            {/* Language Selector Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 cursor-pointer border border-slate-200/80 dark:border-white/10"
              title={t("choose_language")}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                {currentLanguage?.flag} {currentLanguage?.name || "Language"}
              </span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-white/10"
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
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 transition flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-white/10"
              title={t("sign_out")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 md:p-8 max-w-md md:max-w-3xl lg:max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
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
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl btn-primary font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Group</span>
          </button>
          <button
            onClick={() => {
              setIsJoining(true);
              setIsCreating(false);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl btn-surface font-medium text-xs"
          >
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Join Code</span>
          </button>
        </div>

        {/* Create Group Form */}
        {isCreating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (groupName.trim()) createGroupMutation.mutate(groupName);
            }}
            className="card-clean p-5 space-y-3.5 max-w-md mx-auto"
          >
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">
              Create a New Flat Group
            </h3>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 402 Palm Heights"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="px-4 py-1.5 text-xs btn-primary font-medium rounded-lg shadow-xs disabled:opacity-50"
              >
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        )}

        {/* Join Group Form */}
        {isJoining && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteCode.trim()) joinGroupMutation.mutate(inviteCode);
            }}
            className="card-clean p-5 space-y-3.5 max-w-md mx-auto"
          >
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">
              Enter 6-Letter Flat Invite Code
            </h3>
            <input
              type="text"
              required
              autoFocus
              maxLength={8}
              placeholder="e.g. INDORE"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-center text-sm font-bold tracking-widest text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 uppercase"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsJoining(false)}
                className="px-3.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinGroupMutation.isPending}
                className="px-4 py-1.5 text-xs btn-primary font-medium rounded-lg shadow-xs disabled:opacity-50"
              >
                {joinGroupMutation.isPending ? "Joining..." : "Join Group"}
              </button>
            </div>
          </form>
        )}

        {/* Group List */}
        <div className="space-y-3 max-w-md mx-auto">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-[var(--text-muted)]">
              Loading flat groups...
            </div>
          ) : groups && groups.length > 0 ? (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(`/group/${group.id}`)}
                className="card-clean p-4 flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                      {localizeName(group.name, currentLanguage.code)}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Code: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{group.invite_code}</span>
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            ))
          ) : (
            <div className="card-clean text-center py-10 p-6 max-w-md mx-auto">
              <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">No Flats Joined Yet</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Create a new flat or ask your roommate for their 6-letter invite code.
              </p>
            </div>
          )}
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
