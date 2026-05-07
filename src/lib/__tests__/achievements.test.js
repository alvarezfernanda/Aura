import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  evaluateAchievements,
} from "../achievements.js";

const emptyCtx = {
  streak: 0,
  totalSessions: 0,
  hasJournaled: false,
  painLogCount: 0,
  phasesObserved: 0,
  periodsLogged: 0,
  trainedInOvulation: false,
  restedInLuteal: false,
};

const byId = (id) => ACHIEVEMENTS.find((a) => a.id === id);

describe("ACHIEVEMENTS — estructura", () => {
  it("cada logro tiene id, category, name, narrative, glyph y check", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTypeOf("string");
      expect(a.category).toBeTypeOf("string");
      expect(a.name).toBeTypeOf("string");
      expect(a.narrative).toBeTypeOf("string");
      expect(a.glyph).toBeTypeOf("string");
      expect(a.check).toBeTypeOf("function");
    }
  });

  it("todos los ids son únicos", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todas las categorías referenciadas existen en ACHIEVEMENT_CATEGORIES", () => {
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_CATEGORIES).toHaveProperty(a.category);
    }
  });

  it("ningún check se desbloquea con ctx vacío", () => {
    expect(evaluateAchievements(emptyCtx)).toEqual([]);
  });
});

describe("ACHIEVEMENTS — constancia (streak)", () => {
  it("primera_llama: streak >= 3", () => {
    expect(byId("primera_llama").check({ ...emptyCtx, streak: 2 })).toBe(false);
    expect(byId("primera_llama").check({ ...emptyCtx, streak: 3 })).toBe(true);
  });

  it("raiz_firme: streak >= 7", () => {
    expect(byId("raiz_firme").check({ ...emptyCtx, streak: 6 })).toBe(false);
    expect(byId("raiz_firme").check({ ...emptyCtx, streak: 7 })).toBe(true);
  });

  it("nueve_lunas: streak >= 30", () => {
    expect(byId("nueve_lunas").check({ ...emptyCtx, streak: 29 })).toBe(false);
    expect(byId("nueve_lunas").check({ ...emptyCtx, streak: 30 })).toBe(true);
  });

  it("streak alto desbloquea todos los logros de constancia", () => {
    const unlocked = evaluateAchievements({ ...emptyCtx, streak: 30 });
    expect(unlocked).toContain("primera_llama");
    expect(unlocked).toContain("raiz_firme");
    expect(unlocked).toContain("nueve_lunas");
  });
});

describe("ACHIEVEMENTS — hitos (totalSessions)", () => {
  it("primer_cuerpo: totalSessions >= 1", () => {
    expect(byId("primer_cuerpo").check({ ...emptyCtx, totalSessions: 0 })).toBe(false);
    expect(byId("primer_cuerpo").check({ ...emptyCtx, totalSessions: 1 })).toBe(true);
  });

  it("cien_gestos: totalSessions >= 100", () => {
    expect(byId("cien_gestos").check({ ...emptyCtx, totalSessions: 99 })).toBe(false);
    expect(byId("cien_gestos").check({ ...emptyCtx, totalSessions: 100 })).toBe(true);
  });

  it("mil_respiros: totalSessions >= 365", () => {
    expect(byId("mil_respiros").check({ ...emptyCtx, totalSessions: 364 })).toBe(false);
    expect(byId("mil_respiros").check({ ...emptyCtx, totalSessions: 365 })).toBe(true);
  });
});

describe("ACHIEVEMENTS — descubrimientos", () => {
  it("carta_al_cuerpo: requiere hasJournaled", () => {
    expect(byId("carta_al_cuerpo").check({ ...emptyCtx, hasJournaled: false })).toBe(false);
    expect(byId("carta_al_cuerpo").check({ ...emptyCtx, hasJournaled: true })).toBe(true);
  });

  it("primera_escucha: painLogCount >= 1", () => {
    expect(byId("primera_escucha").check({ ...emptyCtx, painLogCount: 0 })).toBe(false);
    expect(byId("primera_escucha").check({ ...emptyCtx, painLogCount: 1 })).toBe(true);
  });

  it("cartografia: phasesObserved >= 3", () => {
    expect(byId("cartografia").check({ ...emptyCtx, phasesObserved: 2 })).toBe(false);
    expect(byId("cartografia").check({ ...emptyCtx, phasesObserved: 3 })).toBe(true);
  });
});

describe("ACHIEVEMENTS — ritos estacionales", () => {
  it("sangrar_calma: periodsLogged >= 1", () => {
    expect(byId("sangrar_calma").check({ ...emptyCtx, periodsLogged: 0 })).toBe(false);
    expect(byId("sangrar_calma").check({ ...emptyCtx, periodsLogged: 1 })).toBe(true);
  });

  it("bloom: trainedInOvulation", () => {
    expect(byId("bloom").check({ ...emptyCtx, trainedInOvulation: false })).toBe(false);
    expect(byId("bloom").check({ ...emptyCtx, trainedInOvulation: true })).toBe(true);
  });

  it("quietud: restedInLuteal", () => {
    expect(byId("quietud").check({ ...emptyCtx, restedInLuteal: false })).toBe(false);
    expect(byId("quietud").check({ ...emptyCtx, restedInLuteal: true })).toBe(true);
  });
});

describe("evaluateAchievements — combinaciones", () => {
  it("ctx completo desbloquea todos", () => {
    const fullCtx = {
      streak: 30,
      totalSessions: 365,
      hasJournaled: true,
      painLogCount: 1,
      phasesObserved: 3,
      periodsLogged: 1,
      trainedInOvulation: true,
      restedInLuteal: true,
    };
    const unlocked = evaluateAchievements(fullCtx);
    expect(unlocked.length).toBe(ACHIEVEMENTS.length);
  });

  it("ctx con sólo streak=7 desbloquea exactamente primera_llama y raiz_firme", () => {
    expect(evaluateAchievements({ ...emptyCtx, streak: 7 })).toEqual([
      "primera_llama",
      "raiz_firme",
    ]);
  });

  it("orden de salida coincide con el orden de definición", () => {
    const fullCtx = {
      streak: 30,
      totalSessions: 365,
      hasJournaled: true,
      painLogCount: 1,
      phasesObserved: 3,
      periodsLogged: 1,
      trainedInOvulation: true,
      restedInLuteal: true,
    };
    const unlocked = evaluateAchievements(fullCtx);
    const declared = ACHIEVEMENTS.map((a) => a.id);
    expect(unlocked).toEqual(declared);
  });
});
