import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DAILY_MANTRAS, getMantraOfDay, getSeasonalMantra } from "../mantras.js";

describe("getMantraOfDay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retorna un mantra de la lista", () => {
    vi.setSystemTime(new Date("2026-05-07T00:00:00Z"));
    expect(DAILY_MANTRAS).toContain(getMantraOfDay());
  });

  it("es estable dentro del mismo día", () => {
    vi.setSystemTime(new Date("2026-05-07T08:00:00Z"));
    const a = getMantraOfDay();
    vi.setSystemTime(new Date("2026-05-07T20:00:00Z"));
    const b = getMantraOfDay();
    expect(a).toBe(b);
  });

  it("rota al día siguiente", () => {
    vi.setSystemTime(new Date("2026-05-07T00:00:00Z"));
    const a = getMantraOfDay();
    vi.setSystemTime(new Date("2026-05-08T00:00:00Z"));
    const b = getMantraOfDay();
    // No siempre es distinto (10 mantras, ciclo) pero el índice se desplaza en 1
    const idxA = DAILY_MANTRAS.indexOf(a);
    const idxB = DAILY_MANTRAS.indexOf(b);
    expect((idxB - idxA + DAILY_MANTRAS.length) % DAILY_MANTRAS.length).toBe(1);
  });
});

describe("getSeasonalMantra", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delega en getMantraOfDay si no hay seasonInfo", () => {
    vi.setSystemTime(new Date("2026-05-07T00:00:00Z"));
    expect(getSeasonalMantra(null)).toBe(getMantraOfDay());
    expect(getSeasonalMantra({})).toBe(getMantraOfDay());
  });

  it("retorna un mantra de la temporada cuando hay seasonInfo", () => {
    vi.setSystemTime(new Date("2026-05-07T00:00:00Z"));
    const seasonInfo = { mantras: ["A", "B", "C"] };
    const result = getSeasonalMantra(seasonInfo);
    expect(seasonInfo.mantras).toContain(result);
  });
});
