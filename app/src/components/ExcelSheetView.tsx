import React, { useState } from "react";
import { formatINR } from "../lib/money";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [mobileMode, setMobileMode] = useState<"compact" | "table">("compact");

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Disambiguate duplicate member names in display
  const nameCounts = new Map<string, number>();
  for (const m of members) {
    const first = m.display_name.trim().toLowerCase().split(/\s+/)[0];
    nameCounts.set(first, (nameCounts.get(first) || 0) + 1);
  }

  function getMemberDisplayName(m: Member) {
    const first = m.display_name.trim().toLowerCase().split(/\s+/)[0];
    const isDupFirst = (nameCounts.get(first) || 0) > 1;
    if (isDupFirst) {
      // If they have full name with surname, return it, else add role/id
      return m.display_name;
    }
    return m.display_name;
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
      "Date",
      "Details",
      "Total (INR)",
      "Paid By",
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
      <div className="bg-white rounded-2xl border border-[#e5e5e7] p-10 text-center shadow-sm">
        <Table className="w-10 h-10 text-[#86868b] mx-auto mb-2 opacity-40" />
        <h4 className="font-semibold text-base text-[#1d1d1f]">No expenses in sheet yet</h4>
        <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
          Add an expense using the + button to start populating this real-time ledger matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Ledger Snapshot Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-[#e5e5e7] rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">
            Total Spent
          </span>
          <span className="text-lg md:text-xl font-black text-[#1d1d1f] tracking-tight block mt-0.5">
            {formatINR(totalSpent)}
          </span>
        </div>
        <div className="p-3.5 bg-white border border-[#e5e5e7] rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">
            Avg per Mate
          </span>
          <span className="text-lg md:text-xl font-bold text-[#0066cc] tracking-tight block mt-0.5">
            {formatINR(avgPerMember)}
          </span>
        </div>
        <div className="p-3.5 bg-white border border-[#e5e5e7] rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">
            Entries
          </span>
          <span className="text-lg md:text-xl font-bold text-[#1d1d1f] tracking-tight block mt-0.5">
            {filteredExpenses.length} bills
          </span>
        </div>
        <div className="p-3.5 bg-white border border-[#e5e5e7] rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">
            Roommates
          </span>
          <span className="text-lg md:text-xl font-bold text-[#1d1d1f] tracking-tight block mt-0.5">
            {members.length} people
          </span>
        </div>
      </div>

      {/* Main Spreadsheet Card */}
      <div className="bg-white rounded-[24px] border border-[#e5e5e7] shadow-sm overflow-hidden">
        {/* Top Filter & View Controls */}
        <div className="p-3.5 md:p-4 bg-[#fbfbfd] border-b border-[#e5e5e7] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by details (e.g. Groceries, Milk, Wifi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0066cc]"
            />
          </div>

          {/* Filter by Roommate + View toggles + Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="px-3 py-2 bg-white border border-[#d2d2d7] rounded-xl text-xs text-[#1d1d1f] font-medium focus:outline-none focus:border-[#0066cc]"
            >
              <option value="all">All Roommates</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMemberDisplayName(m)}
                </option>
              ))}
            </select>

            {/* Mobile View Toggle: Compact Cards vs Matrix Table */}
            <div className="flex sm:hidden border border-[#d2d2d7] rounded-xl p-0.5 bg-white">
              <button
                onClick={() => setMobileMode("compact")}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  mobileMode === "compact"
                    ? "bg-[#0066cc] text-white"
                    : "text-[#86868b]"
                }`}
                title="Cards View (No horizontal scroll)"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
              <button
                onClick={() => setMobileMode("table")}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  mobileMode === "table"
                    ? "bg-[#0066cc] text-white"
                    : "text-[#86868b]"
                }`}
                title="Matrix Table"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] text-xs font-semibold active:scale-95 transition cursor-pointer"
              title="Download Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* MOBILE COMPACT CARDS VIEW (Clean, fast, ZERO horizontal scrolling on phones) */}
        {mobileMode === "compact" && (
          <div className="block sm:hidden divide-y divide-[#f0f0f0]">
            {filteredExpenses.map((expense) => {
              const payer = memberMap.get(expense.paid_by_member_id);
              return (
                <div
                  key={expense.id}
                  onClick={() => onSelectExpense?.(expense.id)}
                  className="p-3.5 hover:bg-[#fafafc] transition cursor-pointer active:bg-[#f0f0f5]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-md">
                        {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <h4 className="font-semibold text-xs text-[#1d1d1f] line-clamp-1">
                        {expense.details}
                      </h4>
                    </div>
                    <span className="font-bold text-xs text-[#1d1d1f]">
                      {formatINR(expense.amount_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1.5 text-[11px] gap-2">
                    <span className="text-[#86868b] truncate">
                      Paid: <span className="font-semibold text-[#0066cc]">{payer?.display_name || "Unknown"}</span>
                    </span>

                    {/* Roommate share chips */}
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {members.map((m) => {
                        const split = expense.splits?.find((s) => s.member_id === m.id);
                        if (!split || split.share_paise === 0n) return null;
                        return (
                          <span
                            key={m.id}
                            className="px-1.5 py-0.5 rounded-md bg-[#f5f5f7] text-[10px] font-medium text-[#1d1d1f]"
                          >
                            {m.display_name.slice(0, 1)}: {formatINR(split.share_paise)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FULL RESPONSIVE MATRIX TABLE (Auto scales to fill tablet & desktop width without horizontal scrolling) */}
        <div
          className={`${
            mobileMode === "compact" ? "hidden sm:block" : "block"
          } overflow-x-auto`}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f5f5f7] border-b border-[#e5e5e7] text-[#86868b] uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-3.5 w-24 border-r border-[#e5e5e7] whitespace-nowrap">
                  Date
                </th>
                <th className="py-3 px-3.5 border-r border-[#e5e5e7] min-w-[140px]">
                  Expense
                </th>
                <th className="py-3 px-3.5 text-right w-24 md:w-28 border-r border-[#e5e5e7] font-extrabold text-[#1d1d1f] whitespace-nowrap">
                  Total (₹)
                </th>
                <th className="py-3 px-3.5 w-28 md:w-32 border-r border-[#e5e5e7] whitespace-nowrap">
                  Paid By
                </th>
                {members.map((m) => (
                  <th
                    key={m.id}
                    className="py-3 px-3 text-right border-r border-[#e5e5e7] last:border-0 font-bold text-[#1d1d1f] min-w-[85px] whitespace-nowrap"
                  >
                    {getMemberDisplayName(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0] text-[#1d1d1f]">
              {filteredExpenses.map((expense) => {
                const payer = memberMap.get(expense.paid_by_member_id);
                const splitMap = new Map(
                  (expense.splits || []).map((s) => [s.member_id, s.share_paise])
                );

                return (
                  <tr
                    key={expense.id}
                    onClick={() => onSelectExpense?.(expense.id)}
                    className="hover:bg-[#f8f9fc] transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3.5 font-medium text-[#86868b] border-r border-[#e5e5e7] text-[11px] whitespace-nowrap">
                      {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium border-r border-[#e5e5e7]">
                      <div className="flex items-center gap-1.5 line-clamp-1">
                        <span className="text-sm">
                          {expense.details.match(/^(\p{Emoji})/u)?.[0] || "🧾"}
                        </span>
                        <span>{expense.details.replace(/^(\p{Emoji}\s*)/u, "")}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-[#1d1d1f] border-r border-[#e5e5e7] whitespace-nowrap">
                      {formatINR(expense.amount_paise)}
                    </td>
                    <td className="py-2.5 px-3.5 border-r border-[#e5e5e7] whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#f0f5ff] text-[#0066cc]">
                        {payer ? getMemberDisplayName(payer) : "Unknown"}
                      </span>
                    </td>
                    {members.map((m) => {
                      const share = splitMap.get(m.id);
                      return (
                        <td
                          key={m.id}
                          className="py-2.5 px-3 text-right border-r border-[#e5e5e7] last:border-0 whitespace-nowrap font-medium text-[11px]"
                        >
                          {share !== undefined && share > 0n ? (
                            <span className="text-[#1d1d1f]">{formatINR(share)}</span>
                          ) : (
                            <span className="text-[#d2d2d7]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Summary Totals Footer Row */}
            <tfoot>
              <tr className="bg-[#f8f9fb] border-t-2 border-[#d2d2d7] font-semibold text-[11px]">
                <td className="py-3 px-3.5 border-r border-[#e5e5e7] text-[#86868b] uppercase text-[10px] font-bold">
                  Summary
                </td>
                <td className="py-3 px-3.5 border-r border-[#e5e5e7] text-[#86868b]">
                  Total Spent
                </td>
                <td className="py-3 px-3.5 text-right font-black text-[#1d1d1f] border-r border-[#e5e5e7] text-xs whitespace-nowrap">
                  {formatINR(totalSpent)}
                </td>
                <td className="py-3 px-3.5 border-r border-[#e5e5e7] text-[10px] text-[#86868b] whitespace-nowrap">
                  Net Balances →
                </td>
                {members.map((m) => {
                  const paid = memberPaidTotals.get(m.id) || 0n;
                  const share = memberShareTotals.get(m.id) || 0n;
                  const net = paid - share;
                  return (
                    <td
                      key={m.id}
                      className="py-3 px-3 text-right border-r border-[#e5e5e7] last:border-0 whitespace-nowrap"
                    >
                      <span
                        className={`font-black block text-xs ${
                          net > 0n
                            ? "text-[#00875a]"
                            : net < 0n
                            ? "text-[#de350b]"
                            : "text-[#1d1d1f]"
                        }`}
                      >
                        {net > 0n ? `+${formatINR(net)}` : formatINR(net)}
                      </span>
                      <span className="text-[10px] text-[#86868b] block font-normal">
                        pd: {formatINR(paid)}
                      </span>
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
