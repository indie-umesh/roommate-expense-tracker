/**
 * Debt simplification and balance calculation.
 * Greedy min-transfers algorithm: matches largest debtor with largest creditor.
 */

export interface MemberBalance {
  memberId: string;
  netPaise: bigint; // positive = owed by group; negative = owes the group
}

export interface SimplifiedTransfer {
  fromMemberId: string; // debtor (who owes)
  toMemberId: string; // creditor (who receives)
  amountPaise: bigint;
}

/**
 * Greedily simplifies debts to minimal transactions.
 * Balances must sum to zero (within rounding tolerances, but here exact integer paise = 0).
 */
export function simplifyDebts(balances: MemberBalance[]): SimplifiedTransfer[] {
  let workingBalances = balances.map((b) => ({ ...b }));
  const sum = workingBalances.reduce((acc, b) => acc + b.netPaise, 0n);
  if (sum !== 0n) {
    console.warn(`Total group balance mismatch (${sum} paise). Rebalancing to prevent screen crash.`);
    const largest = workingBalances.reduce(
      (max, b) => (b.netPaise > max.netPaise ? b : max),
      workingBalances[0]
    );
    if (largest) {
      largest.netPaise -= sum;
    }
  }

  // Separate into debtors (net < 0) and creditors (net > 0)
  const debtors: { memberId: string; owesPaise: bigint }[] = workingBalances
    .filter((b) => b.netPaise < 0n)
    .map((b) => ({ memberId: b.memberId, owesPaise: -b.netPaise }))
    .sort((a, b) => (b.owesPaise > a.owesPaise ? 1 : b.owesPaise < a.owesPaise ? -1 : 0));

  const creditors: { memberId: string; receivesPaise: bigint }[] = workingBalances
    .filter((b) => b.netPaise > 0n)
    .map((b) => ({ memberId: b.memberId, receivesPaise: b.netPaise }))
    .sort((a, b) => (b.receivesPaise > a.receivesPaise ? 1 : b.receivesPaise < a.receivesPaise ? -1 : 0));

  const transfers: SimplifiedTransfer[] = [];

  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    const settleAmount =
      debtor.owesPaise < creditor.receivesPaise
        ? debtor.owesPaise
        : creditor.receivesPaise;

    if (settleAmount > 0n) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountPaise: settleAmount,
      });

      debtor.owesPaise -= settleAmount;
      creditor.receivesPaise -= settleAmount;
    }

    if (debtor.owesPaise === 0n) {
      dIndex++;
    }
    if (creditor.receivesPaise === 0n) {
      cIndex++;
    }
  }

  return transfers;
}

export interface SplitRecord {
  memberId?: string;
  member_id?: string;
  sharePaise?: bigint;
  share_paise?: bigint;
}

export interface ExpenseRecord {
  paidByMemberId?: string;
  paid_by_member_id?: string;
  amountPaise?: bigint;
  amount_paise?: bigint;
  splits?: SplitRecord[];
  deletedAt?: string | null;
  deleted_at?: string | null;
}

export interface SettlementRecord {
  fromMemberId?: string;
  from_member_id?: string;
  toMemberId?: string;
  to_member_id?: string;
  amountPaise?: bigint;
  amount_paise?: bigint;
  deletedAt?: string | null;
  deleted_at?: string | null;
}

/**
 * Pure calculation of net balances from raw active expenses and settlements.
 * net = Σ(expenses paid) − Σ(own shares) + Σ(settlements paid out) − Σ(settlements received)
 */
export function calculateBalances(
  allMemberIds: string[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[]
): MemberBalance[] {
  const balanceMap = new Map<string, bigint>();
  for (const id of allMemberIds) {
    balanceMap.set(id, 0n);
  }

  // Active expenses
  for (const exp of expenses) {
    if (exp.deletedAt || exp.deleted_at) continue;

    const payer = exp.paid_by_member_id || exp.paidByMemberId || "";
    let activeSplitsSum = 0n;

    // Each participant gets -sharePaise
    for (const split of exp.splits || []) {
      const participantId = split.member_id || split.memberId || "";
      const share = split.share_paise ?? split.sharePaise ?? 0n;
      if (balanceMap.has(participantId)) {
        const currentParticipant = balanceMap.get(participantId) || 0n;
        balanceMap.set(participantId, currentParticipant - share);
        activeSplitsSum += share;
      }
    }

    // Payer is credited with activeSplitsSum so total group balance always sums to 0
    if (balanceMap.has(payer)) {
      const currentPayer = balanceMap.get(payer) || 0n;
      balanceMap.set(payer, currentPayer + activeSplitsSum);
    }
  }

  // Active settlements
  for (const set of settlements) {
    if (set.deletedAt || set.deleted_at) continue;

    const fromId = set.from_member_id || set.fromMemberId || "";
    const toId = set.to_member_id || set.toMemberId || "";
    const amount = set.amount_paise ?? set.amountPaise ?? 0n;

    if (balanceMap.has(fromId) && balanceMap.has(toId)) {
      // From paid out -> owes less (+amount)
      const currentFrom = balanceMap.get(fromId) || 0n;
      balanceMap.set(fromId, currentFrom + amount);

      // To received -> owed less (-amount)
      const currentTo = balanceMap.get(toId) || 0n;
      balanceMap.set(toId, currentTo - amount);
    }
  }

  return allMemberIds.map((memberId) => ({
    memberId,
    netPaise: balanceMap.get(memberId) || 0n,
  }));
}
