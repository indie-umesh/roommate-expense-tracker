import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { translateCategory } from "../lib/i18n";
import { localizeName } from "../lib/transliterate";
import { rupeesToPaise } from "../lib/money";
import type { Member } from "../lib/types";
import {
  X,
  Check,
  Loader2,
  Plus,
  Trash2,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AddExpenseModalProps {
  groupId: string;
  members: Member[];
  isOpen: boolean;
  onClose: () => void;
}

export interface CategoryItem {
  id?: string;
  emoji: string;
  label: string;
  isCustom?: boolean;
}

// Built-in Default Categories
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { emoji: "🍔", label: "Swiggy" },
  { emoji: "🍕", label: "Zomato" },
  { emoji: "🛒", label: "Groceries" },
  { emoji: "🥛", label: "Milk" },
  { emoji: "⚡", label: "Wifi/Bills" },
  { emoji: "🧹", label: "Maid/Cook" },
  { emoji: "🏠", label: "Rent" },
  { emoji: "☕", label: "Chai/Cafe" },
  { emoji: "🍿", label: "Snacks" },
  { emoji: "🚕", label: "Cab" },
  { emoji: "💧", label: "Water" },
];

// Smart automatic emoji matcher based on category name
export function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase().trim();
  if (/swiggy|burger|fast\s?food|mcd|kfc/i.test(n)) return "🍔";
  if (/zomato|pizza|dinner|lunch|food|meal|biryani|restaurant/i.test(n)) return "🍕";
  if (/grocer|blinkit|zepto|instamart|market|sabzi|veg|vegetable|ration/i.test(n)) return "🛒";
  if (/milk|dairy|dahi|curd|paneer|amul/i.test(n)) return "🥛";
  if (/wifi|internet|broadband|bill|electric|bijli|recharge|power/i.test(n)) return "⚡";
  if (/maid|cook|clean|safai|bai|sweep/i.test(n)) return "🧹";
  if (/rent|flat|room|broker|deposit|maintenance/i.test(n)) return "🏠";
  if (/chai|tea|coffee|cafe|starbucks|sutta/i.test(n)) return "☕";
  if (/snack|chips|munch|biscuit|namkeen|ice\s?cream|dessert/i.test(n)) return "🍿";
  if (/cab|uber|ola|auto|petrol|fuel|diesel|travel|bus|train|flight/i.test(n)) return "🚕";
  if (/water|pani|bisleri|aquafina|camper|can/i.test(n)) return "💧";
  if (/laundry|dhobi|wash|iron|dry\s?clean/i.test(n)) return "🧺";
  if (/gym|fitness|workout|protein/i.test(n)) return "🏋️";
  if (/med|pharma|doctor|tablet|chemist/i.test(n)) return "💊";
  if (/party|beer|alcohol|drink|wine|pub|club/i.test(n)) return "🎉";
  if (/movie|cinema|netflix|prime|hotstar/i.test(n)) return "🎬";
  if (/shop|cloth|clothes|amazon|flipkart|myntra/i.test(n)) return "🛍️";
  return "🏷️";
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  groupId,
  members,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const detailsInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [amountRupees, setAmountRupees] = useState("");
  const [details, setDetails] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [spentOn] = useState<string>(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggestion dropdown state
  const [isDetailsFocused, setIsDetailsFocused] = useState(false);

  // Category management panel state
  const [showManageTags, setShowManageTags] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [manageError, setManageError] = useState<string | null>(null);

  // Hidden categories tracker in localStorage
  const [hiddenLabels, setHiddenLabels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`roommate_hidden_categories_${groupId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  function saveHiddenLabels(labels: string[]) {
    setHiddenLabels(labels);
    try {
      localStorage.setItem(`roommate_hidden_categories_${groupId}`, JSON.stringify(labels));
    } catch (e) {
      console.error(e);
    }
  }

  // Fetch custom categories from DB for this flat (newest first)
  const { data: dbCategories = [] } = useQuery<CategoryItem[]>({
    queryKey: ["group-categories", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_categories")
        .select("id, name, emoji, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching categories:", error);
        return [];
      }

      return (data || []).map((c: any) => ({
        id: c.id,
        label: c.name,
        emoji: c.emoji || getCategoryEmoji(c.name),
        isCustom: true,
      }));
    },
    enabled: !!groupId && isOpen,
  });

  // Effective categories: newly added categories appear FIRST, followed by defaults
  const activeCategories: CategoryItem[] = React.useMemo(() => {
    // 1. Filter defaults that have not been explicitly hidden/removed
    const visibleDefaults = DEFAULT_CATEGORIES.filter(
      (d) => !hiddenLabels.includes(d.label.toLowerCase())
    );

    // 2. Track custom categories (newest first)
    const customLabels = new Set<string>();
    const customList: CategoryItem[] = [];

    for (const cat of dbCategories) {
      const lower = cat.label.toLowerCase();
      if (!hiddenLabels.includes(lower) && !customLabels.has(lower)) {
        customLabels.add(lower);
        customList.push(cat);
      }
    }

    // 3. Filter remaining defaults that are not shadowed by custom
    const remainingDefaults = visibleDefaults.filter(
      (d) => !customLabels.has(d.label.toLowerCase())
    );

    // Newly added custom categories appear FIRST!
    return [...customList, ...remainingDefaults];
  }, [dbCategories, hiddenLabels]);

  // Add Category Mutation - Automatically computes emoji from name
  const addCategoryMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Please enter a category name");

      // Unhide if was hidden
      if (hiddenLabels.includes(trimmed.toLowerCase())) {
        saveHiddenLabels(hiddenLabels.filter((l) => l !== trimmed.toLowerCase()));
      }

      const assignedEmoji = getCategoryEmoji(trimmed);

      const { data, error } = await supabase
        .from("group_categories")
        .insert({
          group_id: groupId,
          name: trimmed,
          emoji: assignedEmoji,
        })
        .select()
        .single();

      if (error) {
        // If unique constraint error (already exists in DB), unhide it
        if (error.code === "23505") {
          return { name: trimmed, emoji: assignedEmoji };
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-categories", groupId] });
      setNewCatName("");
      setManageError(null);
    },
    onError: (err: any) => {
      setManageError(err?.message || "Failed to add category");
    },
  });

  // Delete / Hide Category Function
  const deleteCategoryMutation = useMutation({
    mutationFn: async (cat: CategoryItem) => {
      if (cat.id) {
        // Custom category in DB: delete from DB
        const { error } = await supabase
          .from("group_categories")
          .delete()
          .eq("id", cat.id);
        if (error) throw error;
      } else {
        // Default category: mark as hidden
        const updated = [...hiddenLabels, cat.label.toLowerCase()];
        saveHiddenLabels(updated);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-categories", groupId] });
    },
  });

  // Reset to Defaults
  const resetCategoriesMutation = useMutation({
    mutationFn: async () => {
      saveHiddenLabels([]);
      await supabase.from("group_categories").delete().eq("group_id", groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-categories", groupId] });
      setManageError(null);
    },
  });

  // Deduplicate members list
  const uniqueMembers = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Member[] = [];
    for (const m of members) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
    return result;
  }, [members]);

  function getMemberLabel(m: Member) {
    const isMe = m.user_id === user?.id;
    const loc = localizeName(m.display_name, currentLanguage.code);
    if (isMe) {
      return `${loc.split(" ")[0]} (${t("you")})`;
    }
    return loc;
  }

  // Setup defaults on modal open
  useEffect(() => {
    if (isOpen) {
      if (uniqueMembers.length > 0) {
        const myMember = uniqueMembers.find((m) => m.user_id === user?.id);
        if (myMember) {
          setPaidByMemberId(myMember.id);
        } else {
          setPaidByMemberId(uniqueMembers[0].id);
        }
        setSelectedMemberIds(uniqueMembers.map((m) => m.id));
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      setAmountRupees("");
      setDetails("");
      setError(null);
      setShowManageTags(false);
      setIsDetailsFocused(false);
    }
  }, [isOpen, uniqueMembers, user]);

  // Click outside listener for auto-suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        detailsInputRef.current &&
        !detailsInputRef.current.contains(event.target as Node)
      ) {
        setIsDetailsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQuickAmount(add: number) {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + add).toString());
  }

  function handleSelectTag(emoji: string, label: string) {
    setDetails(`${emoji} ${label}`);
    setIsDetailsFocused(false);
  }

  // Auto-suggestion filtering
  const matchingSuggestions = React.useMemo(() => {
    const query = details.trim().toLowerCase();
    if (!query) return activeCategories;
    return activeCategories.filter((cat) =>
      cat.label.toLowerCase().includes(query)
    );
  }, [details, activeCategories]);

  const exactMatchExists = activeCategories.some(
    (c) => c.label.toLowerCase() === details.trim().toLowerCase()
  );

  async function handleCreateNewTagOnFly(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const emoji = getCategoryEmoji(trimmed);
    try {
      await addCategoryMutation.mutateAsync({ name: trimmed });
      handleSelectTag(emoji, trimmed);
    } catch {
      handleSelectTag(emoji, trimmed);
    }
  }

  function toggleMemberSplit(memberId: string) {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  }

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!amountRupees || parseFloat(amountRupees) <= 0) {
        throw new Error(t("enter_amount_err"));
      }
      if (!details.trim()) {
        throw new Error(t("what_for"));
      }
      if (!paidByMemberId) {
        throw new Error(t("select_payer_err"));
      }
      if (selectedMemberIds.length === 0) {
        throw new Error(t("select_participants_err"));
      }

      const paise = rupeesToPaise(amountRupees);

      const { data, error } = await supabase.rpc("create_expense", {
        p_group_id: groupId,
        p_paid_by_member_id: paidByMemberId,
        p_amount_paise: paise.toString(),
        p_details: details.trim(),
        p_spent_on: spentOn,
        p_participant_member_ids: selectedMemberIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to add expense");
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60"
          />

          {/* Modal Centered Card */}
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.08, ease: "easeOut" }}
            className="relative bg-white dark:bg-[#111827] text-[var(--text-primary)] w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto border border-slate-200/90 dark:border-white/10 my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  ₹
                </span>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-primary)] tracking-tight">
                    {t("add_expense")}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-normal">
                    {t("add_flat_expense")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* CATEGORY MANAGEMENT PANEL */}
            {showManageTags ? (
              <div className="pt-3 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      {t("category")}
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowManageTags(false)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    {t("done")} ✓
                  </button>
                </div>

                {manageError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs rounded-lg">
                    {manageError}
                  </div>
                )}

                {/* Clean Add Category Form - No Manual Emoji Picker */}
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                    {t("custom_category")}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Laundry, Gym, Movie, Electricity..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCatName.trim()) {
                          e.preventDefault();
                          addCategoryMutation.mutate({ name: newCatName.trim() });
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={!newCatName.trim() || addCategoryMutation.isPending}
                      onClick={() => addCategoryMutation.mutate({ name: newCatName.trim() })}
                      className="px-4 py-2 btn-primary text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("save")}</span>
                    </button>
                  </div>
                </div>

                {/* Structured Categories List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      {t("category")} ({activeCategories.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => resetCategoriesMutation.mutate()}
                      disabled={resetCategoriesMutation.isPending}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t("reset_defaults") || "Reset"}</span>
                    </button>
                  </div>

                  {/* Proper Organized Table / List */}
                  <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 max-h-56 overflow-y-auto">
                    {activeCategories.map((cat) => (
                      <div
                        key={cat.label}
                        className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-sm shrink-0 border border-slate-200/60 dark:border-white/10">
                            {cat.emoji}
                          </span>
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {translateCategory(cat.label, t)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              cat.isCustom
                                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                                : "bg-slate-100 dark:bg-white/5 text-[var(--text-muted)]"
                            }`}
                          >
                            {cat.isCustom ? t("custom_badge") : t("default_badge")}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteCategoryMutation.mutate(cat)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                            title={`Delete ${cat.label}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowManageTags(false)}
                    className="px-4 py-2 btn-primary text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    {t("done")}
                  </button>
                </div>
              </div>
            ) : (
              /* MAIN ADD EXPENSE FORM */
              <div className="space-y-4 pt-3">
                {/* Amount Display */}
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                    {t("amount_inr")}
                  </span>
                  <div className="flex items-center justify-center">
                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mr-1.5">
                      ₹
                    </span>
                    <input
                      ref={inputRef}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="0"
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(e.target.value)}
                      className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] bg-transparent outline-none max-w-[220px] text-center placeholder-slate-400 dark:placeholder-slate-600 tracking-tight"
                    />
                  </div>

                  {/* Quick Add Chips - Wrapped, No Horizontal Scrolling */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 py-0.5">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAmount(amt)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* What was it for + Auto Suggestions + Wrapped Category Chips */}
                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {t("what_for")}
                  </label>
                  <input
                    ref={detailsInputRef}
                    type="text"
                    placeholder="e.g. Swiggy, Groceries, Milk, Rent"
                    value={details}
                    onFocus={() => setIsDetailsFocused(true)}
                    onChange={(e) => {
                      setDetails(e.target.value);
                      setIsDetailsFocused(true);
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500"
                  />

                  {/* AUTO-SUGGESTION DROPDOWN POPUP */}
                  {isDetailsFocused && details.trim().length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg z-30 overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5"
                    >
                      {matchingSuggestions.length > 0 ? (
                        matchingSuggestions.map((cat) => (
                          <button
                            key={cat.label}
                            type="button"
                            onMouseDown={() => handleSelectTag(cat.emoji, cat.label)}
                            className="w-full px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span>{cat.emoji}</span>
                              <span className="font-semibold">{translateCategory(cat.label, t)}</span>
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              {t("done")}
                            </span>
                          </button>
                        ))
                      ) : null}

                      {/* On-the-fly Category Creator with Auto Emoji */}
                      {!exactMatchExists && details.trim().length > 0 && (
                        <button
                          type="button"
                          onMouseDown={() => handleCreateNewTagOnFly(details.trim())}
                          className="w-full px-3 py-2 text-left text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {t("save")} "{getCategoryEmoji(details.trim())} {details.trim()}"
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Wrapped Category Chips - Zero Horizontal Scroll */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {activeCategories.map((tag) => (
                      <button
                        key={tag.label}
                        type="button"
                        onClick={() => handleSelectTag(tag.emoji, tag.label)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                          details.includes(tag.label)
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-semibold"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span>{tag.emoji}</span>
                        <span>{translateCategory(tag.label, t)}</span>
                      </button>
                    ))}

                    {/* Manage / Add Custom Tags Button */}
                    <button
                      type="button"
                      onClick={() => setShowManageTags(true)}
                      className="px-2.5 py-1 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-500/40 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer flex items-center gap-1"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{t("category")}</span>
                    </button>
                  </div>
                </div>

                {/* Paid By - Wrapped, No Horizontal Scroll */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    {t("who_paid")}
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {uniqueMembers.map((member) => {
                      const isSelected = paidByMemberId === member.id;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setPaidByMemberId(member.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10"
                          }`}
                        >
                          {getMemberLabel(member)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Split Equally Among - Wrapped Checkboxes */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("split_count", { count: selectedMemberIds.length })}
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds(uniqueMembers.map((m) => m.id))}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      {t("split_equally")}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {uniqueMembers.map((member) => {
                      const isChecked = selectedMemberIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMemberSplit(member.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition cursor-pointer ${
                            isChecked
                              ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-500/60 text-indigo-700 dark:text-indigo-200"
                              : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-[var(--text-muted)]"
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                              isChecked
                                ? "bg-indigo-600 text-white"
                                : "border border-slate-400 dark:border-slate-600"
                            }`}
                          >
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span>{getMemberLabel(member)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clean Minimal Save Button */}
                <button
                  type="button"
                  disabled={createExpenseMutation.isPending}
                  onClick={() => createExpenseMutation.mutate()}
                  className="w-full mt-2 py-3 px-4 rounded-xl btn-primary text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createExpenseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    `${t("save_expense")} →`
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
