import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getContextualGreeting, getDayMessage } from "../messages.js";

describe("getContextualGreeting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("'Buenos días' antes de mediodía", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 8));
    expect(getContextualGreeting()).toBe("Buenos días");
  });

  it("'Buenas tardes' entre 12 y 19", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 14));
    expect(getContextualGreeting()).toBe("Buenas tardes");
  });

  it("'Buenas noches' a partir de las 19", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 21));
    expect(getContextualGreeting()).toBe("Buenas noches");
  });

  it("trata las 12h como tarde (no día)", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 12));
    expect(getContextualGreeting()).toBe("Buenas tardes");
  });
});

describe("getDayMessage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("entrega el mensaje del lunes", () => {
    vi.setSystemTime(new Date(2026, 4, 4, 12)); // lunes
    expect(getDayMessage()).toMatch(/glúteos y hombros/);
  });

  it("entrega el mensaje del miércoles", () => {
    vi.setSystemTime(new Date(2026, 4, 6, 12)); // miércoles
    expect(getDayMessage()).toMatch(/espalda/);
  });

  it("entrega el mensaje del domingo", () => {
    vi.setSystemTime(new Date(2026, 4, 10, 12)); // domingo
    expect(getDayMessage()).toMatch(/Descanso/);
  });
});
