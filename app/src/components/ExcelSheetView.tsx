import React from "react";
import { formatINR } from "../lib/money";
import type { Member, Expense } from "../lib/types";
import { Table } from "lucide-react";

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
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Calculate Column Totals for the bottom summary
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount_paise, 0n);

  const memberPaidTotals = new Map<string, bigint>();
  const memberShareTotals = new Map<string, bigint>();

  for (const m of members) {
    memberPaidTotals.set(m.id, 0n);
    memberShareTotals.set(m.id, 0n);
  }

  for (const exp of expenses) {
    const curPaid = memberPaidTotals.get(exp.paid_by_member_id) || 0n;
    memberPaidTotals.set(exp.paid_by_member_id, curPaid + exp.amount_paise);

    for (const split of exp.splits || []) {
      const curShare = memberShareTotals.get(split.member_id) || 0n;
      memberShareTotals.set(split.member_id, curShare + split.share_paise);
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e5e7] p-8 text-center shadow-sm">
        <Table className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-50" />
        <h4 className="font-semibold text-sm text-[#1d1d1f]">No expenses in sheet yet</h4>
        <p className="text-xs text-[#86868b] mt-1">
          Add expenses to see the automatic spreadsheet breakdown.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[22px] border border-[#e5e5e7] shadow-sm overflow-hidden">
      {/* Sheet Header Banner */}
      <div className="px-4 py-3 bg-[#fbfbfd] border-b border-[#e5e5e7] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center font-bold text-xs">
            📊
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
            Expense Matrix View
          </span>
        </div>
        <span className="text-[11px] text-[#86868b] font-medium">
          Swipe horizontally →
        </span>
      </div>

      {/* Responsive Horizontal Scroll Matrix Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f5f7] border-b border-[#e5e5e7] text-[#86868b] uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-2.5 px-3 sticky left-0 bg-[#f5f5f7] z-10 min-w-[65px] border-r border-[#e5e5e7]">
                Date
              </th>
              <th className="py-2.5 px-3 min-w-[130px] border-r border-[#e5e5e7]">
                Expense
              </th>
              <th className="py-2.5 px-3 text-right min-w-[85px] border-r border-[#e5e5e7] font-bold text-[#1d1d1f]">
                Total (₹)
              </th>
              <th className="py-2.5 px-3 min-w-[90px] border-r border-[#e5e5e7]">
                Paid By
              </th>
              {members.map((m) => (
                <th
                  key={m.id}
                  className="py-2.5 px-3 text-right min-w-[85px] border-r border-[#e5e5e7] last:border-0 font-semibold text-[#1d1d1f]"
                >
                  {m.display_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0] text-[#1d1d1f]">
            {expenses.map((expense) => {
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
                  <td className="py-2.5 px-3 font-medium text-[#86868b] sticky left-0 bg-white group-hover:bg-[#f8f9fc] z-10 border-r border-[#e5e5e7] text-[11px] whitespace-nowrap">
                    {new Date(expense.spent_on).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="py-2.5 px-3 font-medium border-r border-[#e5e5e7] max-w-[160px] truncate">
                    {expense.details}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#1d1d1f] border-r border-[#e5e5e7] whitespace-nowrap">
                    {formatINR(expense.amount_paise)}
                  </td>
                  <td className="py-2.5 px-3 border-r border-[#e5e5e7] whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0f5ff] text-[#0066cc]">
                      {payer?.display_name || "Unknown"}
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

          {/* Sticky Summary Totals Row */}
          <tfoot>
            <tr className="bg-[#f8f9fb] border-t-2 border-[#d2d2d7] font-semibold text-[11px]">
              <td className="py-2.5 px-3 sticky left-0 bg-[#f8f9fb] z-10 border-r border-[#e5e5e7] text-[#86868b] uppercase text-[10px]">
                Total
              </td>
              <td className="py-2.5 px-3 border-r border-[#e5e5e7] text-[#86868b]">
                Total Spent
              </td>
              <td className="py-2.5 px-3 text-right font-extrabold text-[#1d1d1f] border-r border-[#e5e5e7] text-xs">
                {formatINR(totalSpent)}
              </td>
              <td className="py-2.5 px-3 border-r border-[#e5e5e7] text-[10px] text-[#86868b]">
                Net Balances →
              </td>
              {members.map((m) => {
                const paid = memberPaidTotals.get(m.id) || 0n;
                const share = memberShareTotals.get(m.id) || 0n;
                const net = paid - share;
                return (
                  <td
                    key={m.id}
                    className="py-2.5 px-3 text-right border-r border-[#e5e5e7] last:border-0"
                  >
                    <span
                      className={`font-bold block ${
                        net > 0n
                          ? "text-[#00875a]"
                          : net < 0n
                          ? "text-[#de350b]"
                          : "text-[#1d1d1f]"
                      }`}
                    >
                      {net > 0n ? `+${formatINR(net)}` : formatINR(net)}
                    </span>
                    <span className="text-[9px] text-[#86868b] block font-normal">
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
  );
};
