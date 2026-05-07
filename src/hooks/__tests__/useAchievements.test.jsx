import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useAchievements } from "../useAchievements.js";

const baseProps = {
  streak: 0,
  sesionesGym: [],
  sesionesPilates: [],
  sesionesCuello: [],
  bodyMetrics: {},
  painLog: [],
  cycleHistory: [],
  lastPeriod: null,
  cycleType: null,
};

beforeEach(() => {
  window.localStorage.clear();
  delete window.storage;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useAchievements — ctx derivado de inputs (síncrono via useMemo)", () => {
  it("ctx con valores por defecto cuando no hay datos", () => {
    const { result } = renderHook(() => useAchievements(baseProps));
    expect(result.current.ctx).toMatchObject({
      streak: 0,
      totalSessions: 0,
      hasJournaled: false,
      painLogCount: 0,
      phasesObserved: 0,
      periodsLogged: 0,
      trainedInOvulation: false,
      restedInLuteal: false,
    });
  });

  it("totalSessions suma gym + pilates + cuello", () => {
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        sesionesGym: [{ date: "2026-01-01" }, { date: "2026-01-02" }],
        sesionesPilates: [{ date: "2026-01-03" }],
        sesionesCuello: ["2026-01-04", "2026-01-05"],
      })
    );
    expect(result.current.ctx.totalSessions).toBe(5);
  });

  it("hasJournaled sólo si bodyMetrics.journal es array no vacío", () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, bodyMetrics: { journal: [{}, {}] } })
    );
    expect(result.current.ctx.hasJournaled).toBe(true);
  });

  it("phasesObserved cuenta fases únicas en cycleHistory", () => {
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        cycleHistory: [
          { phase: "menstrual" },
          { phase: "folicular" },
          { phase: "menstrual" },
          { phase: "ovulatoria" },
        ],
      })
    );
    expect(result.current.ctx.phasesObserved).toBe(3);
  });

  it("periodsLogged cuenta entries con type='period' o isPeriod", () => {
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        cycleHistory: [
          { type: "period" },
          { isPeriod: true },
          { phase: "folicular" },
        ],
      })
    );
    expect(result.current.ctx.periodsLogged).toBe(2);
  });

  it("periodsLogged cae a 1 si lastPeriod existe y cycleHistory NO es array", () => {
    // Quirk del código: el fallback (lastPeriod ? 1 : 0) sólo se activa si
    // cycleHistory NO es array. Con [] (caso típico tras onboarding) queda
    // en 0 y este logro nunca se desbloquea por esa vía.
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, cycleHistory: null, lastPeriod: "2026-01-01" })
    );
    expect(result.current.ctx.periodsLogged).toBe(1);
  });

  it("acepta sesiones como string además de objetos", () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, sesionesGym: ["2026-01-01", { date: "2026-01-02" }] })
    );
    expect(result.current.ctx.totalSessions).toBe(2);
  });

  it("inputs no-array no rompen el hook", () => {
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        sesionesGym: null,
        sesionesPilates: undefined,
        sesionesCuello: "no-soy-array",
        cycleHistory: null,
        painLog: null,
        bodyMetrics: null,
      })
    );
    expect(result.current.ctx.totalSessions).toBe(0);
    expect(result.current.ctx.hasJournaled).toBe(false);
  });
});

describe("useAchievements — trainedInOvulation usa fecha de sesión (regresión 4º arg)", () => {
  it("detecta sesión en ovulación independientemente del 'hoy' actual", () => {
    // El test antes del fix fallaba porque calcCyclePhase ignoraba el 4º arg
    // y siempre evaluaba con la fecha de hoy. Ahora la sesión del día 14
    // (ovulación) se detecta por la fecha de la sesión, no la del reloj.
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        lastPeriod: "2026-01-01",
        cycleType: "regular",
        sesionesGym: [{ date: "2026-01-14" }],
      })
    );
    expect(result.current.ctx.trainedInOvulation).toBe(true);
  });

  it("no detecta si las sesiones cayeron fuera de ovulación", () => {
    const { result } = renderHook(() =>
      useAchievements({
        ...baseProps,
        lastPeriod: "2026-01-01",
        cycleType: "regular",
        // día 3 = menstrual, día 25 = lútea
        sesionesGym: [{ date: "2026-01-03" }, { date: "2026-01-25" }],
      })
    );
    expect(result.current.ctx.trainedInOvulation).toBe(false);
  });
});

describe("useAchievements — desbloqueo y cola de reveals", () => {
  it("ctx vacío no encola nada", () => {
    const { result } = renderHook(() => useAchievements(baseProps));
    expect(result.current.currentReveal).toBeNull();
    expect(result.current.revealCount).toBe(0);
  });

  it("streak=3 desbloquea primera_llama y lo encola", async () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 3 })
    );
    await waitFor(() => expect(result.current.revealCount).toBe(1));
    expect(result.current.currentReveal.id).toBe("primera_llama");
    expect(result.current.unlocked.primera_llama).toBeDefined();
    expect(result.current.unlocked.primera_llama.unlockedAt).toMatch(/^\d{4}-/);
  });

  it("streak=7 encola DOS reveals (primera_llama + raiz_firme) en orden", async () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 7 })
    );
    await waitFor(() => expect(result.current.revealCount).toBe(2));
    expect(result.current.currentReveal.id).toBe("primera_llama");
  });

  it("dismissCurrentReveal avanza la cola", async () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 7 })
    );
    await waitFor(() => expect(result.current.revealCount).toBe(2));

    act(() => result.current.dismissCurrentReveal());
    expect(result.current.revealCount).toBe(1);
    expect(result.current.currentReveal.id).toBe("raiz_firme");

    act(() => result.current.dismissCurrentReveal());
    expect(result.current.revealCount).toBe(0);
    expect(result.current.currentReveal).toBeNull();
  });

  it("logros ya desbloqueados no se re-encolan tras hidratar", async () => {
    // Antes del fix de useStorage, el primer render usaba {} y el efecto
    // del check encolaba primera_llama de nuevo. Ahora la hidratación de
    // localStorage es síncrona (lazy init) y el check arranca con el
    // estado real.
    window.localStorage.setItem(
      "aura-achievements-v1",
      JSON.stringify({ primera_llama: { unlockedAt: "2025-01-01" } })
    );
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 3 })
    );
    expect(result.current.unlocked.primera_llama).toBeDefined();
    // Pequeña ventana para que cualquier efecto pendiente corra
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.revealCount).toBe(0);
    expect(result.current.currentReveal).toBeNull();
  });

  it("subir streak 3→7 después del primer dismiss encola sólo el nuevo", async () => {
    const { result, rerender } = renderHook(
      ({ streak }) => useAchievements({ ...baseProps, streak }),
      { initialProps: { streak: 3 } }
    );
    await waitFor(() => expect(result.current.revealCount).toBe(1));

    act(() => result.current.dismissCurrentReveal());
    expect(result.current.revealCount).toBe(0);

    rerender({ streak: 7 });
    await waitFor(() => expect(result.current.revealCount).toBe(1));
    expect(result.current.currentReveal.id).toBe("raiz_firme");
  });
});

describe("useAchievements — persistencia", () => {
  it("escribe los desbloqueados en localStorage", async () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 3 })
    );
    await waitFor(() => expect(result.current.revealCount).toBe(1));
    const stored = JSON.parse(window.localStorage.getItem("aura-achievements-v1"));
    expect(stored.primera_llama).toBeDefined();
    expect(stored.primera_llama.unlockedAt).toMatch(/^\d{4}-/);
  });
});

describe("useAchievements — haptic feedback", () => {
  let vibrate;
  beforeEach(() => {
    vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    delete navigator.vibrate;
  });

  it("dispara navigator.vibrate cuando hay desbloqueos", async () => {
    const { result } = renderHook(() =>
      useAchievements({ ...baseProps, streak: 3 })
    );
    await waitFor(() => expect(result.current.revealCount).toBe(1));
    expect(vibrate).toHaveBeenCalledWith([40, 80, 40]);
  });
});
