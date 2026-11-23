import { describe, it, expect } from "vitest";
import { localizeName, transliterateWordToHindi } from "../transliterate";

describe("transliterate & localizeName", () => {
  it("translates common names into Devanagari when lang is hi", () => {
    expect(localizeName("Umesh", "hi")).toBe("उमेश");
    expect(localizeName("Ritesh Kumar", "hi")).toBe("रितेश कुमार");
    expect(localizeName("Aman Sharma", "hi")).toBe("अमन शर्मा");
    expect(localizeName("Rahul Verma", "hi")).toBe("राहुल वर्मा");
  });

  it("translates flat and location names into Devanagari when lang is hi", () => {
    expect(localizeName("Vikas Nagar Flat", "hi")).toBe("विकास नगर फ्लैट");
    expect(localizeName("Indore Flat", "hi")).toBe("इंदौर फ्लैट");
  });

  it("leaves names untouched when language is English or others", () => {
    expect(localizeName("Umesh", "en")).toBe("Umesh");
    expect(localizeName("Ritesh Kumar", "es")).toBe("Ritesh Kumar");
    expect(localizeName("Vikas Nagar Flat", "fr")).toBe("Vikas Nagar Flat");
  });

  it("handles unlisted phonetic words gracefully", () => {
    expect(localizeName("Karan", "hi")).toBe("करण");
    expect(transliterateWordToHindi("Bhopal")).toBe("भोपाल");
  });
});
