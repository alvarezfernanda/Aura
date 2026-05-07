import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import {
  useContextualReminders,
  CONTEXTUAL_REMINDERS,
} from "../useContextualReminders.js";

const baseProps = {
  painLog: [],
  bodyMetrics: {},
  streak: 0,
  lastPeriod: null,
  cycleType: null,
  season: null,
};

beforeEach(() => {
  window.localStorage.clear();
  delete window.storage;
});

afterEach(() => {
  cleanup();
});

describe("useContextualReminders — sin contexto", () => {
  it("retorna lista vacía con props base", () => {
    const { result } = renderHook(() => useContextualReminders(baseProps));
    expect(result.current.reminders).toEqual([]);
    expect(result.current.topReminder).toBeNull();
  });
});

describe("welcome_period", () => {
  it("se dispara cuando lastPeriod === hoy", () => {
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod: today })
    );
    const ids = result.current.reminders.map((r) => r.id);
    expect(ids).toContain("welcome_period");
    const rem = result.current.reminders.find((r) => r.id === "welcome_period");
    expect(rem.title).toMatch(/empezó tu ciclo/i);
  });

  it("no dispara con lastPeriod en otra fecha", () => {
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod: "2020-01-01" })
    );
    const ids = result.current.reminders.map((r) => r.id);
    expect(ids).not.toContain("welcome_period");
  });
});

describe("body_silence", () => {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  it("no dispara si nunca hubo registro (usuaria nueva)", () => {
    const { result } = renderHook(() => useContextualReminders(baseProps));
    expect(
      result.current.reminders.find((r) => r.id === "body_silence")
    ).toBeFalsy();
  });

  it("dispara con último painLog hace 5 días y sin journal", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        painLog: [{ date: daysAgo(5) }],
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "body_silence")
    ).toBeTruthy();
  });

  it("no dispara si registró hoy", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        painLog: [{ date: daysAgo(0) }],
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "body_silence")
    ).toBeFalsy();
  });

  it("no dispara si pasaron 30+ días (sale del rango)", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        painLog: [{ date: daysAgo(45) }],
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "body_silence")
    ).toBeFalsy();
  });

  it("usa el más reciente entre painLog y journal", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        painLog: [{ date: daysAgo(10) }],
        bodyMetrics: { journal: [{ date: daysAgo(0) }] },
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "body_silence")
    ).toBeFalsy();
  });
});

describe("luteal_gentleness", () => {
  it("dispara cuando lastPeriod cae en fase lútea", () => {
    // 20 días atrás = día ~21 (lútea con ciclo 28)
    const d = new Date();
    d.setDate(d.getDate() - 20);
    const lastPeriod = d.toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod, cycleType: "regular" })
    );
    expect(
      result.current.reminders.find((r) => r.id === "luteal_gentleness")
    ).toBeTruthy();
  });

  it("no dispara fuera de lútea", () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const lastPeriod = d.toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod, cycleType: "regular" })
    );
    expect(
      result.current.reminders.find((r) => r.id === "luteal_gentleness")
    ).toBeFalsy();
  });
});

describe("near_streak_unlock", () => {
  it("se dispara con streak=6 (víspera de Raíz Firme)", () => {
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, streak: 6 })
    );
    const r = result.current.reminders.find((r) => r.id === "near_streak_unlock");
    expect(r).toBeTruthy();
    expect(r.title).toMatch(/Raíz Firme/);
  });

  it("se dispara con streak=29 (víspera de Nueve Lunas)", () => {
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, streak: 29 })
    );
    const r = result.current.reminders.find((r) => r.id === "near_streak_unlock");
    expect(r).toBeTruthy();
    expect(r.title).toMatch(/Nueve Lunas/);
  });

  it("no dispara con streaks intermedias", () => {
    for (const streak of [5, 7, 28, 30]) {
      const { result } = renderHook(() =>
        useContextualReminders({ ...baseProps, streak })
      );
      expect(
        result.current.reminders.find((r) => r.id === "near_streak_unlock")
      ).toBeFalsy();
      cleanup();
    }
  });
});

describe("season_transition", () => {
  it("dispara con daysLeftInSeason ≤ 2", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        season: { name: "Raíz", nextHint: "Ya viene Bloom", daysLeftInSeason: 1 },
      })
    );
    const r = result.current.reminders.find((r) => r.id === "season_transition");
    expect(r).toBeTruthy();
    expect(r.title).toMatch(/Se cierra tu Raíz/);
  });

  it("no dispara si quedan más de 2 días", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        season: { name: "Bloom", daysLeftInSeason: 10 },
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "season_transition")
    ).toBeFalsy();
  });
});

describe("first_day", () => {
  it("dispara cuando season.daysSince === 1", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        season: { daysSince: 1 },
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "first_day")
    ).toBeTruthy();
  });

  it("no dispara después del primer día", () => {
    const { result } = renderHook(() =>
      useContextualReminders({
        ...baseProps,
        season: { daysSince: 5 },
      })
    );
    expect(
      result.current.reminders.find((r) => r.id === "first_day")
    ).toBeFalsy();
  });
});

describe("priorización y dismiss", () => {
  it("topReminder es el de menor priority", () => {
    // welcome_period (1) y near_streak_unlock (2) ambos activos
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod: today, streak: 6 })
    );
    expect(result.current.topReminder.id).toBe("welcome_period");
  });

  it("dismissReminder oculta por las dismissHours configuradas", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod: today })
    );
    expect(result.current.reminders.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.dismissReminder("welcome_period");
    });

    expect(
      result.current.reminders.find((r) => r.id === "welcome_period")
    ).toBeFalsy();
  });

  it("dismiss expirado vuelve a mostrar el reminder", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Pre-poblar localStorage con un dismiss antiguo (hace 100 horas)
    const longAgo = Date.now() - 100 * 3600000;
    window.localStorage.setItem(
      "aura-reminders-dismissed",
      JSON.stringify({ welcome_period: longAgo })
    );
    const { result } = renderHook(() =>
      useContextualReminders({ ...baseProps, lastPeriod: today })
    );
    expect(
      result.current.reminders.find((r) => r.id === "welcome_period")
    ).toBeTruthy();
  });
});

describe("CONTEXTUAL_REMINDERS — estructura", () => {
  it("cada reminder tiene id, priority, tone, dismissHours, check, build", () => {
    for (const r of CONTEXTUAL_REMINDERS) {
      expect(r.id).toBeTypeOf("string");
      expect(r.priority).toBeTypeOf("number");
      expect(r.tone).toBeTypeOf("string");
      expect(r.dismissHours).toBeTypeOf("number");
      expect(r.check).toBeTypeOf("function");
      expect(r.build).toBeTypeOf("function");
    }
  });

  it("ids únicos", () => {
    const ids = CONTEXTUAL_REMINDERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
