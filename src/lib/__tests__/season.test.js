import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calcNarrativeSeason, NARRATIVE_SEASONS, SEASON_CYCLE_LENGTH } from "../season.js";

const dayOffset = (n) => {
  const d = new Date("2026-05-07T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

describe("calcNarrativeSeason", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("retorna Raíz cuando no hay firstUseDate", () => {
    expect(calcNarrativeSeason(null)).toBe(NARRATIVE_SEASONS.raiz);
  });

  it("día 1 = Raíz", () => {
    const s = calcNarrativeSeason(dayOffset(0));
    expect(s.id).toBe("raiz");
    expect(s.daysSince).toBe(1);
    expect(s.dayInCycle).toBe(1);
    expect(s.cycleNumber).toBe(1);
  });

  it("día 30 todavía es Raíz (límite superior)", () => {
    const s = calcNarrativeSeason(dayOffset(29));
    expect(s.id).toBe("raiz");
    expect(s.dayInCycle).toBe(30);
  });

  it("día 31 entra a Bloom", () => {
    const s = calcNarrativeSeason(dayOffset(30));
    expect(s.id).toBe("bloom");
    expect(s.dayInCycle).toBe(31);
  });

  it("día 75 es Bloom (límite superior)", () => {
    const s = calcNarrativeSeason(dayOffset(74));
    expect(s.id).toBe("bloom");
    expect(s.dayInCycle).toBe(75);
  });

  it("día 76 entra a Quietud", () => {
    const s = calcNarrativeSeason(dayOffset(75));
    expect(s.id).toBe("quietud");
  });

  it("día 121 reinicia a Raíz con cycleNumber=2", () => {
    const s = calcNarrativeSeason(dayOffset(SEASON_CYCLE_LENGTH));
    expect(s.id).toBe("raiz");
    expect(s.cycleNumber).toBe(2);
    expect(s.dayInCycle).toBe(1);
  });

  it("progress está en [0, 1]", () => {
    for (let d = 0; d < 200; d += 7) {
      const s = calcNarrativeSeason(dayOffset(d));
      expect(s.progress).toBeGreaterThanOrEqual(0);
      expect(s.progress).toBeLessThanOrEqual(1);
    }
  });

  it("daysIntoSeason + daysLeftInSeason = totalSeasonLength", () => {
    const s = calcNarrativeSeason(dayOffset(40));
    expect(s.daysIntoSeason + s.daysLeftInSeason).toBe(s.totalSeasonLength);
  });
});
