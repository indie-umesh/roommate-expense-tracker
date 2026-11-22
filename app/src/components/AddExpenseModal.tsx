import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
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
}

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

const EMOJI_OPTIONS = ["🍔", "🍕", "🛒", "🥛", "⚡", "🧹", "🏠", "☕", "🍿", "🚕", "💧", "🧺", "🏋️", "💊", "🧴", "🎉", "🧾"];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  groupId,
  members,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
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
  const [newCatEmoji, setNewCatEmoji] = useState("🧾");
  const [manageError, setManageError] = useState<string | null>(null);

  // Fetch categories from DB for this flat
  const { data: dbCategories = [] } = useQuery<CategoryItem[]>({
    queryKey: ["group-categories", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_categories")
        .select("id, name, emoji")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching categories:", error);
        return [];
      }

      return (data || []).map((c: any) => ({
        id: c.id,
        label: c.name,
        emoji: c.emoji || "🧾",
      }));
    },
    enabled: !!groupId && isOpen,
  });

  // Effective categories: if DB has custom categories, use them; else fallback to defaults
  const activeCategories: CategoryItem[] = React.useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories;
    }
    return DEFAULT_CATEGORIES;
  }, [dbCategories]);

  // Add Category Mutation
  const addCategoryMutation = useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Category name required");

      const { data, error } = await supabase
        .from("group_categories")
        .insert({
          group_id: groupId,
          name: trimmed,
          emoji: emoji || "🧾",
        })
        .select()
        .single();

      if (error) throw error;
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

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("group_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-categories", groupId] });
    },
  });

  // Reset to Defaults Mutation (copies DEFAULT_CATEGORIES into DB)
  const resetCategoriesMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("group_categories").delete().eq("group_id", groupId);

      const toInsert = DEFAULT_CATEGORIES.map((c) => ({
        group_id: groupId,
        name: c.label,
        emoji: c.emoji,
      }));

      const { error } = await supabase.from("group_categories").insert(toInsert);
      if (error) throw error;
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
    if (isMe) {
      return `You (${m.display_name.split(" ")[0]})`;
    }
    return m.display_name;
  }

  // Setup defaults on open
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
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setAmountRupees("");
      setDetails("");
      setError(null);
      setShowManageTags(false);
      setIsDetailsFocused(false);
    }
  }, [isOpen, uniqueMembers, user]);

  // Click outside to close auto-suggestion dropdown
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
    try {
      await addCategoryMutation.mutateAsync({ name: trimmed, emoji: "🧾" });
      handleSelectTag("🧾", trimmed);
    } catch {
      handleSelectTag("🧾", trimmed);
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
        throw new Error("Enter an amount (e.g. ₹150)");
      }
      if (!details.trim()) {
        throw new Error("What was this for? (e.g. Swiggy, Groceries)");
      }
      if (!paidByMemberId) {
        throw new Error("Select who paid this bill");
      }
      if (selectedMemberIds.length === 0) {
        throw new Error("Select at least 1 person to split");
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
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Centered Card - No Bottom Slider */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
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
                    Add Expense
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-normal">
                    Split bills in seconds
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

            {/* CATEGORY MANAGEMENT PANEL (OVERLAY VIEW) */}
            {showManageTags ? (
              <div className="pt-3 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      Manage Categories
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowManageTags(false)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Done ✓
                  </button>
                </div>

                {manageError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs rounded-lg">
                    {manageError}
                  </div>
                )}

                {/* Create New Category Form */}
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 space-y-2.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                    Create New Category
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={newCatEmoji}
                      onChange={(e) => setNewCatEmoji(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-base cursor-pointer focus:outline-none"
                    >
                      {EMOJI_OPTIONS.map((em) => (
                        <option key={em} value={em}>
                          {em}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Category name (e.g. Swiggy, Netflix)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCatName.trim()) {
                          e.preventDefault();
                          addCategoryMutation.mutate({
                            name: newCatName.trim(),
                            emoji: newCatEmoji,
                          });
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={!newCatName.trim() || addCategoryMutation.isPending}
                      onClick={() =>
                        addCategoryMutation.mutate({
                          name: newCatName.trim(),
                          emoji: newCatEmoji,
                        })
                      }
                      className="px-3.5 py-1.5 btn-primary text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Existing Categories List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
                    <span>Active Tags ({activeCategories.length})</span>
                    <button
                      type="button"
                      onClick={() => resetCategoriesMutation.mutate()}
                      disabled={resetCategoriesMutation.isPending}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Defaults</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeCategories.map((cat) => (
                      <div
                        key={cat.label}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5"
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                        {cat.id && (
                          <button
                            type="button"
                            onClick={() => deleteCategoryMutation.mutate(cat.id!)}
                            className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                            title="Delete category"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
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
                    Done Managing Tags
                  </button>
                </div>
              </div>
            ) : (
              /* MAIN ADD EXPENSE FORM */
              <div className="space-y-4 pt-3">
                {/* Amount Display */}
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                    Amount Spent
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

                {/* What was it for + Auto Suggestions + Category Chips */}
                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    What was this for?
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
                              <span className="font-semibold">{cat.label}</span>
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              Select
                            </span>
                          </button>
                        ))
                      ) : null}

                      {/* On-the-fly Category Creator */}
                      {!exactMatchExists && details.trim().length > 0 && (
                        <button
                          type="button"
                          onMouseDown={() => handleCreateNewTagOnFly(details.trim())}
                          className="w-full px-3 py-2 text-left text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Use & save "{details.trim()}" as a new category</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Wrapped Category Chips - Absolutely NO Horizontal Scroll */}
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
                        <span>{tag.label}</span>
                      </button>
                    ))}

                    {/* Manage / Add Custom Tags Button */}
                    <button
                      type="button"
                      onClick={() => setShowManageTags(true)}
                      className="px-2.5 py-1 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-500/40 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer flex items-center gap-1"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>Manage Tags</span>
                    </button>
                  </div>
                </div>

                {/* Paid By - Wrapped, No Horizontal Scroll */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Who Paid?
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
                      Split Among ({selectedMemberIds.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds(uniqueMembers.map((m) => m.id))}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Equal Split (All)
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
                    "Split & Save →"
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
