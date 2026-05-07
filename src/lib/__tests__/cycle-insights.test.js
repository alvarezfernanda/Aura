import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { detectFertileWindow, detectPatterns } from "../cycle-insights.js";

const today = new Date("2026-05-07T00:00:00");
const dStr = (d) => d.toISOString().slice(0, 10);
const dateOffset = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return dStr(d);
};

describe("detectFertileWindow — entradas inválidas / insuficientes", () => {
  it("retorna null si symptoms no es objeto", () => {
    expect(detectFertileWindow(null)).toBeNull();
    expect(detectFertileWindow("nope")).toBeNull();
  });

  it("retorna null con menos de 2 entradas", () => {
    expect(detectFertileWindow({ "2026-04-01": { mucus: "eggwhite" } })).toBeNull();
  });

  it("retorna null si no hay signos cervicales ni dolor ovárico", () => {
    const symptoms = {
      "2026-04-01": { symptoms: ["cramps"] },
      "2026-04-02": { symptoms: ["mood"] },
    };
    expect(detectFertileWindow(symptoms)).toBeNull();
  });
});

describe("detectFertileWindow — confianza", () => {
  it("alta con 2+ días de moco elástico", () => {
    const symptoms = {
      "2026-04-10": { mucus: "eggwhite" },
      "2026-04-11": { mucus: "eggwhite" },
    };
    const r = detectFertileWindow(symptoms);
    expect(r.confidence).toBe("alta");
    expect(r.signal).toMatch(/Moco cervical elástico/);
    expect(r.fertileStart).toBe("2026-04-10");
    expect(r.fertileEnd).toBe("2026-04-11");
  });

  it("alta con 1 moco elástico + 1 dolor ovárico", () => {
    const symptoms = {
      "2026-04-10": { mucus: "eggwhite" },
      "2026-04-11": { symptoms: ["cm_ovul"] },
    };
    const r = detectFertileWindow(symptoms);
    expect(r.confidence).toBe("alta");
    expect(r.signal).toMatch(/Moco elástico \+ dolor ovárico/);
  });

  it("media con 1 día de moco elástico solo", () => {
    const symptoms = {
      "2026-04-10": { mucus: "eggwhite" },
      "2026-04-11": { symptoms: [] },
    };
    expect(detectFertileWindow(symptoms).confidence).toBe("media");
  });

  it("media con dolor ovárico sin moco", () => {
    const symptoms = {
      "2026-04-10": { symptoms: ["cm_ovul"] },
      "2026-04-11": { symptoms: ["cm_ovul"] },
    };
    const r = detectFertileWindow(symptoms);
    expect(r.confidence).toBe("media");
    expect(r.signal).toMatch(/Dolor ovárico/);
  });

  it("flag hasLibido cuando algún día reportó libido", () => {
    const symptoms = {
      "2026-04-10": { mucus: "eggwhite" },
      "2026-04-11": { mucus: "eggwhite", symptoms: ["libido"] },
    };
    expect(detectFertileWindow(symptoms).hasLibido).toBe(true);
  });
});

describe("detectFertileWindow — filtrado por lastPeriod", () => {
  it("ignora síntomas anteriores al último período", () => {
    const symptoms = {
      "2026-03-01": { mucus: "eggwhite" },
      "2026-03-02": { mucus: "eggwhite" },
      "2026-04-10": { mucus: "eggwhite" },
      "2026-04-11": { mucus: "eggwhite" },
    };
    const r = detectFertileWindow(symptoms, "2026-04-01");
    expect(r.fertileStart).toBe("2026-04-10");
    expect(r.fertileEnd).toBe("2026-04-11");
    // 2 días post-period: confianza alta
    expect(r.confidence).toBe("alta");
  });

  it("retorna null si tras filtrar quedan <2 entradas", () => {
    const symptoms = {
      "2026-03-01": { mucus: "eggwhite" },
      "2026-04-10": { mucus: "eggwhite" },
    };
    expect(detectFertileWindow(symptoms, "2026-04-01")).toBeNull();
  });
});

describe("detectPatterns — entradas inválidas / insuficientes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  it("retorna [] si symptoms no es objeto", () => {
    expect(detectPatterns(null)).toEqual([]);
  });

  it("retorna [] con menos de 7 días registrados", () => {
    const symptoms = {};
    for (let i = 0; i < 6; i++) symptoms[dateOffset(i)] = { symptoms: ["cramps"] };
    expect(detectPatterns(symptoms)).toEqual([]);
  });
});

describe("detectPatterns — patrones de síntomas en últimos 30 días", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  const buildSymptoms = (count, sym) => {
    const symptoms = {};
    for (let i = 0; i < count; i++) symptoms[dateOffset(i)] = { symptoms: [sym] };
    // Asegurar que el total sea >= 7 para pasar el guard
    for (let i = count; i < Math.max(count, 7); i++) symptoms[dateOffset(i)] = { symptoms: [] };
    return symptoms;
  };

  it("warning si ≥5 días con cólicos", () => {
    const r = detectPatterns(buildSymptoms(5, "cramps"));
    expect(r.find((x) => /cólicos/i.test(x.text))).toBeTruthy();
  });

  it("no warning con 4 días de cólicos", () => {
    const r = detectPatterns(buildSymptoms(4, "cramps"));
    expect(r.find((x) => /cólicos/i.test(x.text))).toBeFalsy();
  });

  it("info si ≥10 días de baja energía", () => {
    const r = detectPatterns(buildSymptoms(10, "low_energy"));
    expect(r.find((x) => /cansancio/i.test(x.text))).toBeTruthy();
  });

  it("info si ≥7 días de irritabilidad", () => {
    const r = detectPatterns(buildSymptoms(7, "mood"));
    expect(r.find((x) => /Irritabilidad/i.test(x.text))).toBeTruthy();
  });

  it("ignora días anteriores a 30 días atrás", () => {
    const symptoms = {};
    for (let i = 0; i < 7; i++) symptoms[dateOffset(40 + i)] = { symptoms: ["cramps"] };
    expect(detectPatterns(symptoms)).toEqual([]);
  });
});

describe("detectPatterns — variación de ciclo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });
  afterEach(() => vi.useRealTimers());

  // Necesitamos symptoms con ≥7 entradas para superar el guard.
  const baselineSymptoms = () => {
    const s = {};
    for (let i = 0; i < 7; i++) s[dateOffset(50 + i)] = { symptoms: [] };
    return s;
  };

  it("warning si la variación entre ciclos > 20 días", () => {
    const cycleHistory = ["2025-10-01", "2025-11-01", "2026-02-15"]; // 31, 106 → filtrado: 31 + ?
    // 31 días y 106 días — 106 está fuera del rango (10..90), se filtra solo 31. necesitamos >= 2 diffs.
    const cycleHistory2 = ["2025-10-01", "2025-10-25", "2025-12-10"]; // diffs: 24, 46 → variación 22
    const r = detectPatterns(baselineSymptoms(), cycleHistory2);
    expect(r.find((x) => /varía/i.test(x.text))).toBeTruthy();
  });

  it("sin warning si variación ≤ 20", () => {
    const cycleHistory = ["2025-10-01", "2025-10-29", "2025-11-26"]; // diffs: 28, 28
    const r = detectPatterns(baselineSymptoms(), cycleHistory);
    expect(r.find((x) => /varía/i.test(x.text))).toBeFalsy();
  });

  it("filtra diffs <= 10 o >= 90 días", () => {
    const cycleHistory = ["2025-10-01", "2025-10-05", "2026-04-01"]; // diffs: 4, ~178 → ambos filtrados
    const r = detectPatterns(baselineSymptoms(), cycleHistory);
    expect(r.find((x) => /varía/i.test(x.text))).toBeFalsy();
  });

  it("requiere ≥3 entradas en cycleHistory", () => {
    const r = detectPatterns(baselineSymptoms(), ["2025-10-01", "2025-11-01"]);
    expect(r.find((x) => /varía/i.test(x.text))).toBeFalsy();
  });
});
