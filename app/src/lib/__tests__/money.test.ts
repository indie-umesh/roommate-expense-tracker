import { describe, it, expect } from "vitest";
import { formatINR, rupeesToPaise, paiseToRupees } from "../money";

describe("money utilities", () => {
  it("converts rupees to paise and vice versa", () => {
    expect(rupeesToPaise(100)).toBe(10000n);
    expect(rupeesToPaise("1250.50")).toBe(125050n);
    expect(paiseToRupees(125050n)).toBe(1250.5);
  });

  it("formats Indian Rupee formatting correctly with en-IN", () => {
    expect(formatINR(12345600n)).toBe("₹1,23,456");
    expect(formatINR(125000n)).toBe("₹1,250");
    expect(formatINR(125050n, true)).toBe("₹1,250.50");
    expect(formatINR(-50000n)).toBe("-₹500");
  });
});
