import React, { useState } from "react";
import { formatINR } from "../lib/money";
import { useLanguage } from "../context/LanguageContext";
import { formatDateLocale } from "../lib/i18n";
import { localizeName } from "../lib/transliterate";
import type { Member, Expense } from "../lib/types";
import { Table, LayoutList, Search, Download } from "lucide-react";

interface ExcelSheetViewProps {
  members: Member[];
  expenses: Expense[];
  onSelectExpense?: (expenseId: string) => void;
}

export const ExcelSheetView: React.FC<ExcelSheetViewProps> = ({
  members,
  expenses,
  onSelectExpense,
}) => {
  const { t, currentLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [mobileMode, setMobileMode] = useState<"compact" | "table">("compact");

  const memberMap = new Map(members.map((m) => [m.id, m]));

  function getMemberDisplayName(m: Member) {
    return localizeName(m.display_name, currentLanguage.code);
  }

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMember =
      filterMemberId === "all" ||
      e.paid_by_member_id === filterMemberId ||
      e.splits?.some((s) => s.member_id === filterMemberId);
    return matchesSearch && matchesMember;
  });

  // Calculate totals
  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount_paise, 0n);
  const avgPerMember = members.length > 0 ? totalSpent / BigInt(members.length) : 0n;

  const memberPaidTotals = new Map<string, bigint>();
  const memberShareTotals = new Map<string, bigint>();

  for (const m of members) {
    memberPaidTotals.set(m.id, 0n);
    memberShareTotals.set(m.id, 0n);
  }

  for (const exp of filteredExpenses) {
    const curPaid = memberPaidTotals.get(exp.paid_by_member_id) || 0n;
    memberPaidTotals.set(exp.paid_by_member_id, curPaid + exp.amount_paise);

    for (const split of exp.splits || []) {
      const curShare = memberShareTotals.get(split.member_id) || 0n;
      memberShareTotals.set(split.member_id, curShare + split.share_paise);
    }
  }

  // Export to CSV function
  function exportCSV() {
    const headers = [
      t("date"),
      t("what_for"),
      t("total_inr"),
      t("who_paid"),
      ...members.map((m) => getMemberDisplayName(m)),
    ];

    const rows = filteredExpenses.map((exp) => {
      const payer = memberMap.get(exp.paid_by_member_id);
      const splitMap = new Map((exp.splits || []).map((s) => [s.member_id, s.share_paise]));
      return [
        exp.spent_on,
        `"${exp.details.replace(/"/g, '""')}"`,
        (Number(exp.amount_paise) / 100).toFixed(2),
        `"${payer?.display_name || "Unknown"}"`,
        ...members.map((m) => {
          const s = splitMap.get(m.id);
          return s ? (Number(s) / 100).toFixed(2) : "0.00";
        }),
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `roommate-expenses-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (expenses.length === 0) {
    return (
      <div className="card-clean p-10 text-center">
        <Table className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
        <h4 className="font-semibold text-base text-[var(--text-primary)]">{t("no_expenses_sheet")}</h4>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
          {t("no_expenses_sheet_desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Ledger Snapshot Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-clean p-4">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            {t("total_spent")}
          </span>
          <span className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight block mt-1">
            {formatINR(totalSpent)}
          </span>
        </div>
        <div className="card-clean p-4">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            {t("overview")}
          </span>
          <span className="text-xl md:text-2xl font-bold text-amber-500 tracking-tight block mt-1">
            {formatINR(avgPerMember)}
          </span>
        </div>
        <div className="card-clean p-4">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            {t("sheet")}
          </span>
          <span className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight block mt-1">
            {filteredExpenses.length}
          </span>
        </div>
        <div className="card-clean p-4">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            {t("roommates")}
          </span>
          <span className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight block mt-1">
            {members.length}
          </span>
        </div>
      </div>

      {/* Main Spreadsheet Card */}
      <div className="card-clean overflow-hidden">
        {/* Top Filter & View Controls */}
        <div className="p-3.5 md:p-4 bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`${t("what_for")}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter by Roommate + View toggles + Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">{t("roommates")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMemberDisplayName(m)}
                </option>
              ))}
            </select>

            {/* Mobile View Toggle: Compact Cards vs Matrix Table */}
            <div className="flex sm:hidden border border-slate-200 dark:border-white/10 rounded-lg p-0.5 bg-white dark:bg-slate-900">
              <button
                onClick={() => setMobileMode("compact")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  mobileMode === "compact"
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text-muted)]"
                }`}
                title={t("card_view")}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>{t("card_view")}</span>
              </button>
              <button
                onClick={() => setMobileMode("table")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  mobileMode === "table"
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text-muted)]"
                }`}
                title={t("table_view")}
              >
                <Table className="w-3.5 h-3.5" />
                <span>{t("table_view")}</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={exportCSV}
              className="btn-surface flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              title="Download Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{t("export_csv")}</span>
            </button>
          </div>
        </div>

        {/* MOBILE COMPACT CARDS VIEW (Clean, fast, ZERO horizontal scrolling on phones) */}
        {mobileMode === "compact" && (
          <div className="block sm:hidden divide-y divide-slate-100 dark:divide-white/5">
            {filteredExpenses.map((expense) => {
              const payer = memberMap.get(expense.paid_by_member_id);
              return (
                <div
                  key={expense.id}
                  onClick={() => onSelectExpense?.(expense.id)}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-[var(--text-muted)] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">
                        {formatDateLocale(expense.spent_on, currentLanguage.code, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <h4 className="font-medium text-xs text-[var(--text-primary)] line-clamp-1">
                        {expense.details}
                      </h4>
                    </div>
                    <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                      {formatINR(expense.amount_paise)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div>
                      {t("paid_by")}: <span className="font-medium text-[var(--text-primary)]">{payer ? localizeName(payer.display_name, currentLanguage.code) : t("roommates")}</span>
                    </div>
                    <div>
                      {t("split_count", { count: expense.splits?.length || 0 })}
                    </div>
                  </div>

                  {/* Individual shares */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {expense.splits?.map((split) => {
                      const m = memberMap.get(split.member_id);
                      if (!m) return null;
                      return (
                        <span
                          key={split.member_id}
                          className="text-[10px] bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5"
                        >
                          {localizeName(m.display_name, currentLanguage.code)}: {formatINR(split.share_paise)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FULL SPREADSHEET MATRIX TABLE (Scrolls gracefully on tablets and desktops) */}
        <div className={`${mobileMode === "compact" ? "hidden sm:block" : "block"} overflow-x-auto`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4 w-28 whitespace-nowrap">{t("date")}</th>
                <th className="py-3 px-4 min-w-[160px]">{t("what_for")}</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">{t("total_inr")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("who_paid")}</th>
                {members.map((m) => (
                  <th key={m.id} className="py-3 px-4 text-right whitespace-nowrap min-w-[90px]">
                    {getMemberDisplayName(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-normal">
              {filteredExpenses.map((exp) => {
                const payer = memberMap.get(exp.paid_by_member_id);
                const splitMap = new Map((exp.splits || []).map((s) => [s.member_id, s.share_paise]));

                return (
                  <tr
                    key={exp.id}
                    onClick={() => onSelectExpense?.(exp.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--text-muted)] text-[11px]">
                      {formatDateLocale(exp.spent_on, currentLanguage.code, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                      {exp.details}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {formatINR(exp.amount_paise)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-[var(--text-primary)] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded text-[11px]">
                        {payer ? localizeName(payer.display_name, currentLanguage.code) : t("roommates")}
                      </span>
                    </td>
                    {members.map((m) => {
                      const share = splitMap.get(m.id);
                      const isPayer = exp.paid_by_member_id === m.id;
                      return (
                        <td
                          key={m.id}
                          className={`py-3 px-4 text-right whitespace-nowrap ${
                            share ? "text-[var(--text-primary)]" : "text-slate-300 dark:text-slate-700"
                          }`}
                        >
                          {share ? (
                            <span className={isPayer ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""}>
                              {formatINR(share)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with Aggregate Totals */}
            <tfoot>
              <tr className="bg-slate-50 dark:bg-white/[0.04] border-t-2 border-slate-200 dark:border-white/10 font-semibold text-xs">
                <td colSpan={2} className="py-3 px-4 text-[var(--text-primary)] uppercase tracking-wider">
                  {t("total_inr")}
                </td>
                <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                  {formatINR(totalSpent)}
                </td>
                <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
                  {t("monthly_summary")}
                </td>
                {members.map((m) => {
                  const paid = memberPaidTotals.get(m.id) || 0n;
                  const share = memberShareTotals.get(m.id) || 0n;
                  const net = paid - share;
                  return (
                    <td key={m.id} className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-bold text-[var(--text-primary)]">
                        {formatINR(share)}
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${
                          net > 0n
                            ? "text-emerald-600 dark:text-emerald-400"
                            : net < 0n
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {net > 0n ? `+${formatINR(net)}` : net < 0n ? formatINR(net) : "0"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
