import { describe, it, expect } from "vitest";
import { toRoman } from "../roman.js";

describe("toRoman", () => {
  it("convierte 1..10 a numerales romanos", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(10)).toBe("X");
  });

  it("retorna '0' para 0 (el || hace fallback a String(num))", () => {
    // roman[0] === "" (falsy), por lo que el || cae al String(num).
    // Es un quirk del código actual, no un bug — pero conviene fijarlo en test.
    expect(toRoman(0)).toBe("0");
  });

  it("retorna el número como string si excede 10", () => {
    expect(toRoman(11)).toBe("11");
    expect(toRoman(42)).toBe("42");
  });
});
