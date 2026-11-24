import { describe, it, expect } from "vitest";
import { validateGenuineContact } from "../validation";

describe("validateGenuineContact", () => {
  it("accepts genuine email addresses", () => {
    const res1 = validateGenuineContact("akbar@gmail.com");
    expect(res1.isValid).toBe(true);
    expect(res1.type).toBe("email");
    expect(res1.normalizedValue).toBe("akbar@gmail.com");

    const res2 = validateGenuineContact("amar.jaiswal@company.co.in");
    expect(res2.isValid).toBe(true);
    expect(res2.type).toBe("email");
  });

  it("rejects disposable / temporary email domains", () => {
    const temp1 = validateGenuineContact("scammer@mailinator.com");
    expect(temp1.isValid).toBe(false);
    expect(temp1.errorMessage).toContain("Temporary/disposable emails are not accepted");

    const temp2 = validateGenuineContact("fake@10minutemail.com");
    expect(temp2.isValid).toBe(false);

    const temp3 = validateGenuineContact("bot@yopmail.com");
    expect(temp3.isValid).toBe(false);
  });

  it("accepts valid Indian mobile numbers starting with 6, 7, 8, 9", () => {
    const num9 = validateGenuineContact("9826012345");
    expect(num9.isValid).toBe(true);
    expect(num9.type).toBe("phone");
    expect(num9.normalizedValue).toBe("+919826012345");

    const num8 = validateGenuineContact("+91 81234 56789");
    expect(num8.isValid).toBe(true);
    expect(num8.normalizedValue).toBe("+918123456789");

    const num7 = validateGenuineContact("7000123456");
    expect(num7.isValid).toBe(true);

    const num6 = validateGenuineContact("6200123456");
    expect(num6.isValid).toBe(true);
  });

  it("rejects mobile numbers not starting with 6, 7, 8, 9", () => {
    const res = validateGenuineContact("5551234567");
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain("Valid Indian mobile numbers must start with 6, 7, 8, or 9");

    const res2 = validateGenuineContact("1234567890");
    expect(res2.isValid).toBe(false);
  });

  it("rejects dummy repeated numbers like 9999999999", () => {
    const num99 = validateGenuineContact("9999999999");
    expect(num99.isValid).toBe(false);
    expect(num99.errorMessage).toContain("Dummy number detected");

    const num88 = validateGenuineContact("8888888888");
    expect(num88.isValid).toBe(false);

    const num77 = validateGenuineContact("7777777777");
    expect(num77.isValid).toBe(false);
  });

  it("rejects fake sequential patterns like 9876543210", () => {
    const res = validateGenuineContact("9876543210");
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain("genuine mobile number");
  });
});
