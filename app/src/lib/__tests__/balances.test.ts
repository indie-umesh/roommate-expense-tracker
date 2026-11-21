import { describe, it, expect } from "vitest";
import { calculateBalances, simplifyDebts } from "../balances";

describe("calculateBalances & simplifyDebts", () => {
  it("balances sum to zero after expense", () => {
    const members = ["umesh", "aman", "ritesh"];
    const expenses = [
      {
        paidByMemberId: "umesh",
        amountPaise: 30000n, // ₹300 paid by Umesh for all 3 (₹100 each)
        splits: [
          { memberId: "umesh", sharePaise: 10000n },
          { memberId: "aman", sharePaise: 10000n },
          { memberId: "ritesh", sharePaise: 10000n },
        ],
      },
    ];

    const balances = calculateBalances(members, expenses, []);
    const total = balances.reduce((acc, b) => acc + b.netPaise, 0n);
    expect(total).toBe(0n);

    expect(balances.find((b) => b.memberId === "umesh")?.netPaise).toBe(20000n);
    expect(balances.find((b) => b.memberId === "aman")?.netPaise).toBe(-10000n);
    expect(balances.find((b) => b.memberId === "ritesh")?.netPaise).toBe(-10000n);

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(2);
    expect(transfers).toContainEqual({
      fromMemberId: "aman",
      toMemberId: "umesh",
      amountPaise: 10000n,
    });
    expect(transfers).toContainEqual({
      fromMemberId: "ritesh",
      toMemberId: "umesh",
      amountPaise: 10000n,
    });
  });

  it("settlement zeroes a pair", () => {
    const members = ["umesh", "aman"];
    const expenses = [
      {
        paidByMemberId: "umesh",
        amountPaise: 10000n,
        splits: [
          { memberId: "umesh", sharePaise: 5000n },
          { memberId: "aman", sharePaise: 5000n },
        ],
      },
    ];
    // Aman settles by paying Umesh ₹50 (5000 paise)
    const settlements = [
      {
        fromMemberId: "aman",
        toMemberId: "umesh",
        amountPaise: 5000n,
      },
    ];

    const balances = calculateBalances(members, expenses, settlements);
    expect(balances.find((b) => b.memberId === "umesh")?.netPaise).toBe(0n);
    expect(balances.find((b) => b.memberId === "aman")?.netPaise).toBe(0n);

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(0);
  });

  it("soft-deleted expense is excluded from balances", () => {
    const members = ["umesh", "aman"];
    const expenses = [
      {
        paidByMemberId: "umesh",
        amountPaise: 10000n,
        splits: [
          { memberId: "umesh", sharePaise: 5000n },
          { memberId: "aman", sharePaise: 5000n },
        ],
        deletedAt: new Date().toISOString(), // soft deleted
      },
    ];

    const balances = calculateBalances(members, expenses, []);
    expect(balances.find((b) => b.memberId === "umesh")?.netPaise).toBe(0n);
    expect(balances.find((b) => b.memberId === "aman")?.netPaise).toBe(0n);
  });

  it("balances sum to zero after random complex sequences", () => {
    const members = ["u1", "u2", "u3", "u4"];
    const expenses = [
      {
        paidByMemberId: "u1",
        amountPaise: 40000n,
        splits: [
          { memberId: "u1", sharePaise: 10000n },
          { memberId: "u2", sharePaise: 10000n },
          { memberId: "u3", sharePaise: 10000n },
          { memberId: "u4", sharePaise: 10000n },
        ],
      },
      {
        paidByMemberId: "u3",
        amountPaise: 15000n,
        splits: [
          { memberId: "u1", sharePaise: 7500n },
          { memberId: "u3", sharePaise: 7500n },
        ],
      },
    ];
    const settlements = [
      {
        fromMemberId: "u2",
        toMemberId: "u1",
        amountPaise: 5000n,
      },
    ];

    const balances = calculateBalances(members, expenses, settlements);
    const sum = balances.reduce((acc, b) => acc + b.netPaise, 0n);
    expect(sum).toBe(0n);

    const simplified = simplifyDebts(balances);
    // Applying simplified transfers should net every member back to 0
    const testMap = new Map<string, bigint>();
    for (const b of balances) testMap.set(b.memberId, b.netPaise);

    for (const t of simplified) {
      testMap.set(t.fromMemberId, testMap.get(t.fromMemberId)! + t.amountPaise);
      testMap.set(t.toMemberId, testMap.get(t.toMemberId)! - t.amountPaise);
    }

    for (const net of testMap.values()) {
      expect(net).toBe(0n);
    }
  });
});
