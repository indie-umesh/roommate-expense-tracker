import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Home,
  Receipt,
  MessageSquare,
  Search,
  AlertTriangle,
  X,
  Phone,
  Mail,
  Trash2,
  Lock,
  ArrowRight,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { MARKETING_HOMEPAGE_URL } from "../lib/config";

interface SuggestionItem {
  id: string;
  contact_type: "email" | "phone";
  contact_value: string;
  category: "suggestion" | "feature_request" | "bug_report" | "complaint" | "other";
  message: string;
  status: "new" | "reviewed" | "in_progress" | "resolved" | "archived";
  admin_notes: string | null;
  turnstile_verified: boolean;
  created_at: string;
}

const SUPERADMIN_PIN = "982600"; // Master Superadmin Access PIN

export const SuperadminPage: React.FC = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Superadmin — Roommate";
  }, []);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("roommate_superadmin_auth") === "true";
  });
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Filter & Search states
  const [selectedTab, setSelectedTab] = useState<"suggestions" | "groups" | "profiles">("suggestions");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Details Modal Popup State
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestionItem | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("new");

  useEffect(() => {
    if (activeSuggestion) {
      setEditingNotes(activeSuggestion.admin_notes || "");
      setSelectedStatus(activeSuggestion.status);
    }
  }, [activeSuggestion]);

  // 1. Fetch Statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: async () => {
      const [profilesRes, groupsRes, expensesRes, suggestionsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("expenses").select("amount_paise"),
        supabase.from("suggestions").select("id, status"),
      ]);

      const totalPaise = (expensesRes.data || []).reduce((acc, row) => acc + (Number(row.amount_paise) || 0), 0);
      const totalSuggestions = (suggestionsRes.data || []).length;
      const pendingSuggestions = (suggestionsRes.data || []).filter((s) => s.status === "new").length;

      return {
        totalUsers: profilesRes.count || 0,
        totalGroups: groupsRes.count || 0,
        totalExpenses: expensesRes.data?.length || 0,
        totalMoneyInRupees: Math.round(totalPaise / 100),
        totalSuggestions,
        pendingSuggestions,
      };
    },
    enabled: isAuthenticated,
  });

  // 2. Fetch Suggestions
  const { data: suggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<SuggestionItem[]>({
    queryKey: ["superadmin-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated,
  });

  // 3. Fetch Groups
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["superadmin-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, invite_code, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && selectedTab === "groups",
  });

  // 4. Update Suggestion Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes: string }) => {
      const { error } = await supabase
        .from("suggestions")
        .update({ status, admin_notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setActiveSuggestion(null);
    },
  });

  // 5. Delete Suggestion Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setActiveSuggestion(null);
    },
  });

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === SUPERADMIN_PIN) {
      sessionStorage.setItem("roommate_superadmin_auth", "true");
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("roommate_superadmin_auth");
    setIsAuthenticated(false);
    setPinInput("");
  };

  // If not authenticated, render PIN Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#1d1d1f] border border-black/10 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Superadmin Access</h2>
            <p className="text-xs text-[#86868b] mt-1">Enter Master PIN to access statistics and data</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-3">
              {/* 6 Visual PIN Boxes */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = pinInput.length > idx;
                  const isCurrent = pinInput.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-12 rounded-xl border flex items-center justify-center text-lg font-bold transition-all ${
                        isFilled
                          ? "border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc]"
                          : isCurrent
                          ? "border-[#0066cc] ring-2 ring-[#0066cc]/20 bg-transparent"
                          : "border-black/15 dark:border-white/15 bg-transparent"
                      }`}
                    >
                      {isFilled ? "●" : ""}
                    </div>
                  );
                })}
              </div>

              {/* Clean input without awkward tracking distortion */}
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ""));
                  setPinError(false);
                }}
                placeholder="Enter 6-digit Master PIN"
                className="w-full text-center text-xs py-2 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:border-[#0066cc]"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-rose-500 font-medium">Invalid Superadmin PIN. Try again.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pinInput.length < 4}
              className="w-full py-2.5 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-medium transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Unlock Superadmin</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter suggestions
  const filteredSuggestions = (suggestions || []).filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      item.contact_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/8 dark:border-white/10 px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href={MARKETING_HOMEPAGE_URL}
            className="shrink-0 transition-transform duration-150 hover:scale-105 focus:outline-none"
            title="Return to Roommate Homepage"
          >
            <BrandLogo size={32} showText={false} />
          </a>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <span>Roommate Superadmin</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                Live Data
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              refetchStats();
              refetchSuggestions();
            }}
            className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-black/8 dark:border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[#86868b]">
              <span className="text-xs font-semibold">Users</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-[#1d1d1f] dark:text-white">
              {statsLoading ? "..." : stats?.totalUsers}
            </p>
            <span className="text-[10px] text-[#86868b]">Registered Profiles</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-black/8 dark:border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[#86868b]">
              <span className="text-xs font-semibold">Flats</span>
              <Home className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-[#1d1d1f] dark:text-white">
              {statsLoading ? "..." : stats?.totalGroups}
            </p>
            <span className="text-[10px] text-[#86868b]">Active Groups</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-black/8 dark:border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[#86868b]">
              <span className="text-xs font-semibold">Bills Logged</span>
              <Receipt className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-[#1d1d1f] dark:text-white">
              {statsLoading ? "..." : stats?.totalExpenses}
            </p>
            <span className="text-[10px] text-[#86868b]">
              ₹{statsLoading ? "..." : stats?.totalMoneyInRupees.toLocaleString("en-IN")} Total
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-black/8 dark:border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[#86868b]">
              <span className="text-xs font-semibold">Suggestions</span>
              <MessageSquare className="w-4 h-4 text-[#0066cc]" />
            </div>
            <p className="text-2xl font-bold text-[#0066cc] dark:text-[#2997ff]">
              {statsLoading ? "..." : stats?.totalSuggestions}
            </p>
            <span className="text-[10px] text-[#86868b]">Feedback Submissions</span>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-black/8 dark:border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[#86868b]">
              <span className="text-xs font-semibold">Pending Review</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {statsLoading ? "..." : stats?.pendingSuggestions}
            </p>
            <span className="text-[10px] text-[#86868b]">Awaiting Action</span>
          </div>
        </div>

        {/* Tab Switcher & Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/8 dark:border-white/10 pb-3">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTab("suggestions")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedTab === "suggestions"
                    ? "bg-[#0066cc] text-white"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                }`}
              >
                Suggestions ({suggestions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab("groups")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedTab === "groups"
                    ? "bg-[#0066cc] text-white"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                }`}
              >
                Groups & Flats ({stats?.totalGroups || 0})
              </button>
            </div>

            {/* Suggestions Search & Status Filter */}
            {selectedTab === "suggestions" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contact or keyword..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#1d1d1f] text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:border-[#0066cc]"
                  />
                </div>

                {/* Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#1d1d1f] text-xs text-[#1d1d1f] dark:text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: SUGGESTIONS TABLE */}
          {selectedTab === "suggestions" && (
            <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#1d1d1f] overflow-hidden shadow-sm">
              {suggestionsLoading ? (
                <div className="py-16 text-center text-xs text-[#86868b]">Loading suggestions...</div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#86868b] space-y-1">
                  <p className="font-semibold text-[#1d1d1f] dark:text-white text-sm">No suggestions found</p>
                  <p>When users submit feedback via the frontend suggestion panel, it will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-black/40 text-[#86868b] uppercase text-[10px] font-semibold border-b border-black/8 dark:border-white/10">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Contact</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5 max-w-xs">Message Preview</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {filteredSuggestions.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => setActiveSuggestion(item)}
                          className="hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer"
                        >
                          <td className="p-3.5 font-mono text-[#86868b] whitespace-nowrap">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          <td className="p-3.5 font-medium text-[#1d1d1f] dark:text-white whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {item.contact_type === "phone" ? (
                                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Mail className="w-3.5 h-3.5 text-[#0066cc]" />
                              )}
                              <span>{item.contact_value}</span>
                            </span>
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#1d1d1f] dark:text-white font-medium text-[11px]">
                              {item.category.replace("_", " ")}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs truncate text-[#86868b]">
                            {item.message}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                item.status === "new"
                                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400"
                                  : item.status === "reviewed"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                                  : item.status === "in_progress"
                                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSuggestion(item);
                              }}
                              className="text-[#0066cc] dark:text-[#2997ff] font-semibold hover:underline"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUPS DATA TABLE */}
          {selectedTab === "groups" && (
            <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#1d1d1f] overflow-hidden shadow-sm">
              {groupsLoading ? (
                <div className="py-16 text-center text-xs text-[#86868b]">Loading groups...</div>
              ) : (groups || []).length === 0 ? (
                <div className="py-16 text-center text-xs text-[#86868b]">No active groups yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-black/40 text-[#86868b] uppercase text-[10px] font-semibold border-b border-black/8 dark:border-white/10">
                      <tr>
                        <th className="p-3.5">Flat / Group Name</th>
                        <th className="p-3.5">Invite Code</th>
                        <th className="p-3.5">Created Date</th>
                        <th className="p-3.5 text-right">Group ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {groups?.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                          <td className="p-3.5 font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2">
                            <span>🏠</span>
                            <span>{g.name}</span>
                          </td>
                          <td className="p-3.5 font-mono text-[#0066cc] dark:text-[#2997ff] font-semibold">
                            {g.invite_code}
                          </td>
                          <td className="p-3.5 font-mono text-[#86868b]">
                            {new Date(g.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-3.5 text-right font-mono text-[11px] text-[#86868b]">
                            {g.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* SUGGESTION DETAILS POPUP MODAL */}
      {activeSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#1d1d1f] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-black/8 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/40">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {activeSuggestion.category.replace("_", " ")}
                </span>
                <span className="text-xs text-[#86868b]">
                  {new Date(activeSuggestion.created_at).toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSuggestion(null)}
                className="p-1 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              
              {/* Contact Information */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#86868b]">Genuine User Contact:</span>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1f] dark:text-white">
                  {activeSuggestion.contact_type === "phone" ? (
                    <>
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <a href={`tel:${activeSuggestion.contact_value}`} className="hover:underline">
                        {activeSuggestion.contact_value}
                      </a>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-[#0066cc]" />
                      <a href={`mailto:${activeSuggestion.contact_value}`} className="hover:underline">
                        {activeSuggestion.contact_value}
                      </a>
                    </>
                  )}
                  <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Verified Contact
                  </span>
                </div>
              </div>

              {/* Full Message */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#86868b]">User Message / Suggestion:</label>
                <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-xs sm:text-sm text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap leading-relaxed">
                  {activeSuggestion.message}
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#86868b]">Update Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="new">New (Unreviewed)</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Admin Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#86868b]">Internal Admin Notes:</label>
                <textarea
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add private notes on follow-up, phone call, or status..."
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:border-[#0066cc] resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-black/8 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this suggestion?")) {
                    deleteMutation.mutate(activeSuggestion.id);
                  }
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSuggestion(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateMutation.mutate({
                      id: activeSuggestion.id,
                      status: selectedStatus,
                      admin_notes: editingNotes.trim(),
                    });
                  }}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
