/**
 * Equal split logic.
 * base = floor(amount / n)
 * remainder = amount - base * n
 * First `remainder` participants (sorted deterministically by memberId) receive +1 paise.
 * Total sum of shares must always equal amountPaise exactly.
 */

export interface SplitResult {
  memberId: string;
  sharePaise: bigint;
}

export function calculateEqualSplit(
  amountPaise: bigint,
  memberIds: string[]
): SplitResult[] {
  if (memberIds.length === 0) {
    throw new Error("Cannot split among zero members");
  }
  if (amountPaise <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  // Sort deterministically to ensure reproducible split remainder distribution
  const sortedMembers = [...memberIds].sort();
  const n = BigInt(sortedMembers.length);
  const base = amountPaise / n;
  const remainder = amountPaise % n;

  let allocatedTotal = 0n;
  const results: SplitResult[] = sortedMembers.map((memberId, index) => {
    const extra = BigInt(index) < remainder ? 1n : 0n;
    const share = base + extra;
    allocatedTotal += share;
    return {
      memberId,
      sharePaise: share,
    };
  });

  if (allocatedTotal !== amountPaise) {
    throw new Error(
      `Split invariant violated: sum of shares (${allocatedTotal}) != total (${amountPaise})`
    );
  }

  return results;
}
