import { describe, it, expect } from "vitest";
import { calculateEqualSplit } from "../split";

describe("calculateEqualSplit", () => {
  it("splits ₹100.00 (10000 paise) equally among 3 members with deterministic remainder", () => {
    // 10000 / 3 = 3333 with remainder 1. First member gets 3334, others 3333.
    const members = ["user-c", "user-a", "user-b"];
    const splits = calculateEqualSplit(10000n, members);

    expect(splits).toHaveLength(3);
    const total = splits.reduce((acc, s) => acc + s.sharePaise, 0n);
    expect(total).toBe(10000n);

    // Sorted members: user-a, user-b, user-c
    const userA = splits.find((s) => s.memberId === "user-a");
    const userB = splits.find((s) => s.memberId === "user-b");
    const userC = splits.find((s) => s.memberId === "user-c");

    expect(userA?.sharePaise).toBe(3334n);
    expect(userB?.sharePaise).toBe(3333n);
    expect(userC?.sharePaise).toBe(3333n);
  });

  it("handles amount not divisible evenly (remainder 2 among 3)", () => {
    // ₹100.01 (10001 paise) / 3 = 3333 remainder 2 -> 3334, 3334, 3333
    const members = ["m1", "m2", "m3"];
    const splits = calculateEqualSplit(10001n, members);

    expect(splits.reduce((acc, s) => acc + s.sharePaise, 0n)).toBe(10001n);
    expect(splits[0].sharePaise).toBe(3334n);
    expect(splits[1].sharePaise).toBe(3334n);
    expect(splits[2].sharePaise).toBe(3333n);
  });

  it("handles a single participant (full amount)", () => {
    const splits = calculateEqualSplit(50000n, ["only-me"]);
    expect(splits).toEqual([{ memberId: "only-me", sharePaise: 50000n }]);
  });

  it("handles participants that are a subset of the group", () => {
    const members = ["umesh", "aman"]; // ritesh excluded
    const splits = calculateEqualSplit(50000n, members);
    expect(splits).toEqual([
      { memberId: "aman", sharePaise: 25000n },
      { memberId: "umesh", sharePaise: 25000n },
    ]);
  });

  it("throws when member list is empty or amount is invalid", () => {
    expect(() => calculateEqualSplit(1000n, [])).toThrow();
    expect(() => calculateEqualSplit(0n, ["m1"])).toThrow();
    expect(() => calculateEqualSplit(-500n, ["m1"])).toThrow();
  });
});
