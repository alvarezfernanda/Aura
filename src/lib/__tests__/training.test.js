import { describe, it, expect } from "vitest";
import { suggestWeight } from "../training.js";

const exercise = { id: "hip_thrust", baseWeight: 40 };

const session = (sets) => ({ date: "2026-05-01", sets });

describe("suggestWeight — sin historial", () => {
  it("retorna baseWeight con source 'base'", () => {
    const r = suggestWeight(exercise, [], "media");
    expect(r.suggested).toBe(40);
    expect(r.source).toBe("base");
  });

  it("trata historial null igual que vacío", () => {
    const r = suggestWeight(exercise, null, "media");
    expect(r.suggested).toBe(40);
    expect(r.source).toBe("base");
  });
});

describe("suggestWeight — energía", () => {
  it("alta + RIR holgado (≥2) sube 5%", () => {
    const hist = [session([{ weight: 50, rir: 2 }, { weight: 50, rir: 3 }])];
    const r = suggestWeight(exercise, hist, "alta");
    // 50 * 1.05 = 52.5 → redondeo a 0.5 = 52.5
    expect(r.suggested).toBe(52.5);
    expect(r.message).toMatch(/Subimos 5%/);
  });

  it("alta + RIR apretado (<2) sube poco", () => {
    const hist = [session([{ weight: 50, rir: 1 }, { weight: 50, rir: 0 }])];
    const r = suggestWeight(exercise, hist, "alta");
    // 50 * 1.02 = 51, redondeo a 0.5 = 51
    expect(r.suggested).toBe(51);
    expect(r.message).toMatch(/Subimos poco/);
  });

  it("media mantiene el peso", () => {
    const hist = [session([{ weight: 50, rir: 2 }])];
    const r = suggestWeight(exercise, hist, "media");
    expect(r.suggested).toBe(50);
    expect(r.message).toMatch(/Consolida técnica/);
  });

  it("baja recorta 12%", () => {
    const hist = [session([{ weight: 50, rir: 2 }])];
    const r = suggestWeight(exercise, hist, "baja");
    // 50 * 0.88 = 44, redondeo a 0.5 = 44
    expect(r.suggested).toBe(44);
    expect(r.message).toMatch(/Bajamos 12%/);
  });
});

describe("suggestWeight — fase del ciclo", () => {
  const hist = [session([{ weight: 50, rir: 2 }])];

  it("ovulatoria multiplica 1.03 sobre la base", () => {
    const r = suggestWeight(exercise, hist, "media", "ovulatoria");
    // 50 * 1 * 1.03 = 51.5
    expect(r.suggested).toBe(51.5);
    expect(r.message).toMatch(/ovulatoria/i);
  });

  it("folicular añade nota pero no cambia peso", () => {
    const r = suggestWeight(exercise, hist, "media", "folicular");
    expect(r.suggested).toBe(50);
    expect(r.message).toMatch(/Folicular/);
  });

  it("lútea baja 5%", () => {
    const r = suggestWeight(exercise, hist, "media", "lutea");
    // 50 * 1 * 0.95 = 47.5
    expect(r.suggested).toBe(47.5);
    expect(r.message).toMatch(/Lútea/);
  });

  it("menstrual baja 15%", () => {
    const r = suggestWeight(exercise, hist, "media", "menstrual");
    // 50 * 1 * 0.85 = 42.5
    expect(r.suggested).toBe(42.5);
    expect(r.message).toMatch(/Menstrual/);
  });
});

describe("suggestWeight — combinación energía + ciclo", () => {
  it("baja + menstrual aplican ambos multiplicadores", () => {
    const hist = [session([{ weight: 50, rir: 2 }])];
    const r = suggestWeight(exercise, hist, "baja", "menstrual");
    // 50 * 0.88 * 0.85 = 37.4 → redondeo a 0.5 = 37.5
    expect(r.suggested).toBe(37.5);
  });

  it("redondea siempre a múltiplo de 0.5", () => {
    const hist = [session([{ weight: 47, rir: 2 }])];
    const r = suggestWeight(exercise, hist, "alta");
    // 47 * 1.05 = 49.35 → 49.5
    expect(r.suggested * 2).toBe(Math.round(r.suggested * 2));
  });
});

describe("suggestWeight — edge cases", () => {
  it("sets vacíos no rompen (división por max(length, 1))", () => {
    const hist = [session([])];
    const r = suggestWeight(exercise, hist, "media");
    expect(r.suggested).toBe(0);
    expect(r.source).toBe("aprendido");
  });

  it("RIR como string se parsea", () => {
    const hist = [session([{ weight: 40, rir: "2" }, { weight: 40, rir: "3" }])];
    const r = suggestWeight(exercise, hist, "alta");
    expect(r.message).toMatch(/Subimos 5%/);
  });

  it("usa SOLO la última sesión del historial", () => {
    const hist = [
      session([{ weight: 100, rir: 2 }]), // se ignora
      session([{ weight: 50, rir: 2 }]),  // se usa
    ];
    const r = suggestWeight(exercise, hist, "media");
    expect(r.suggested).toBe(50);
  });
});
