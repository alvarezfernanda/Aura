import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calcCyclePhase, CYCLE_PHASES } from "../cycle.js";

// Genera un string YYYY-MM-DD desplazado n días desde una fecha fija (today).
const today = new Date("2026-05-07T00:00:00");
const dateNDaysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

describe("calcCyclePhase — entradas inválidas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  it("retorna null cuando lastPeriodDate es null", () => {
    expect(calcCyclePhase(null)).toBeNull();
  });

  it("retorna null para fecha inválida", () => {
    expect(calcCyclePhase("no-es-fecha")).toBeNull();
  });

  it("retorna null cuando la fecha es futura", () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    expect(calcCyclePhase(future.toISOString().slice(0, 10))).toBeNull();
  });
});

describe("calcCyclePhase — ciclo regular (28 días)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  it("día 1 = menstrual", () => {
    const r = calcCyclePhase(dateNDaysAgo(0));
    expect(r.phase).toBe("menstrual");
    expect(r.dayOfCycle).toBe(1);
    expect(r.uncertain).toBe(false);
    expect(r.data).toBe(CYCLE_PHASES.menstrual);
  });

  it("día 5 = menstrual (límite)", () => {
    expect(calcCyclePhase(dateNDaysAgo(4)).phase).toBe("menstrual");
  });

  it("día 6 = folicular", () => {
    expect(calcCyclePhase(dateNDaysAgo(5)).phase).toBe("folicular");
  });

  it("día 13 = folicular (límite)", () => {
    expect(calcCyclePhase(dateNDaysAgo(12)).phase).toBe("folicular");
  });

  it("día 14 = ovulatoria", () => {
    expect(calcCyclePhase(dateNDaysAgo(13)).phase).toBe("ovulatoria");
  });

  it("día 16 = ovulatoria (límite)", () => {
    expect(calcCyclePhase(dateNDaysAgo(15)).phase).toBe("ovulatoria");
  });

  it("día 17 = lútea", () => {
    expect(calcCyclePhase(dateNDaysAgo(16)).phase).toBe("lutea");
  });

  it("día 28 = lútea", () => {
    expect(calcCyclePhase(dateNDaysAgo(27)).phase).toBe("lutea");
  });

  it("envuelve al día 1 después del 28", () => {
    const r = calcCyclePhase(dateNDaysAgo(28));
    expect(r.dayOfCycle).toBe(1);
    expect(r.phase).toBe("menstrual");
  });
});

describe("calcCyclePhase — referenceDate (4º arg)", () => {
  // Sin tocar el reloj: con referenceDate explícita la función no debería
  // depender del Date actual.
  const lastPeriod = "2026-01-01";

  it("día 1 cuando referenceDate = lastPeriod", () => {
    const r = calcCyclePhase(lastPeriod, 28, "regular", "2026-01-01");
    expect(r.phase).toBe("menstrual");
    expect(r.dayOfCycle).toBe(1);
  });

  it("día 14 (ovulatoria) cuando referenceDate = lastPeriod + 13 días", () => {
    const r = calcCyclePhase(lastPeriod, 28, "regular", "2026-01-14");
    expect(r.phase).toBe("ovulatoria");
    expect(r.dayOfCycle).toBe(14);
  });

  it("día 20 (lútea) cuando referenceDate = lastPeriod + 19 días", () => {
    const r = calcCyclePhase(lastPeriod, 28, "regular", "2026-01-20");
    expect(r.phase).toBe("lutea");
    expect(r.dayOfCycle).toBe(20);
  });

  it("regresión: el 4º arg ya no se ignora silenciosamente", () => {
    // Antes del fix: pasar una fecha en ovulación se ignoraba y dependía del reloj.
    // Hoy es día 14 desde lastPeriod = ovulatoria con certeza.
    const ovulationDate = "2026-01-14";
    const r = calcCyclePhase(lastPeriod, 28, "regular", ovulationDate);
    expect(r.phase).toBe("ovulatoria");
  });

  it("referenceDate inválido retorna null", () => {
    expect(calcCyclePhase(lastPeriod, 28, "regular", "no-es-fecha")).toBeNull();
  });

  it("referenceDate anterior al lastPeriod retorna null", () => {
    expect(calcCyclePhase(lastPeriod, 28, "regular", "2025-12-25")).toBeNull();
  });

  it("respeta cycleType=irregular con referenceDate", () => {
    const r = calcCyclePhase(lastPeriod, 28, "irregular", "2026-01-15");
    expect(r.phase).toBe("unknown");
    expect(r.uncertain).toBe(true);
  });
});

describe("calcCyclePhase — ciclo irregular", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  it("día 1-5 = menstrual con certeza", () => {
    const r = calcCyclePhase(dateNDaysAgo(2), 28, "irregular");
    expect(r.phase).toBe("menstrual");
    expect(r.uncertain).toBe(false);
  });

  it("post sangrado = unknown con uncertain=true", () => {
    const r = calcCyclePhase(dateNDaysAgo(10), 28, "irregular");
    expect(r.phase).toBe("unknown");
    expect(r.uncertain).toBe(true);
    expect(r.data).toBe(CYCLE_PHASES.unknown);
  });

  it("no envuelve al día 1 (sigue contando hacia adelante)", () => {
    const r = calcCyclePhase(dateNDaysAgo(45), 28, "irregular");
    expect(r.phase).toBe("unknown");
    expect(r.dayOfCycle).toBe(46);
  });
});
