import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { todayStr, weekKey, monthKey, DAY_OF_WEEK, isNightTime } from "../dates.js";

describe("todayStr", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retorna la fecha de hoy en formato YYYY-MM-DD", () => {
    vi.setSystemTime(new Date("2026-05-07T10:00:00Z"));
    expect(todayStr()).toBe("2026-05-07");
  });

  it("usa la fecha UTC, no la local", () => {
    vi.setSystemTime(new Date("2026-01-01T23:30:00Z"));
    expect(todayStr()).toBe("2026-01-01");
  });
});

describe("weekKey", () => {
  it("retorna la clave ISO-like YYYY-Www", () => {
    expect(weekKey(new Date(2026, 4, 7))).toMatch(/^2026-W\d{2}$/);
  });

  it("usa padding de 2 dígitos para semanas tempranas", () => {
    const k = weekKey(new Date(2026, 0, 4));
    expect(k.split("-W")[1]).toMatch(/^\d{2}$/);
  });

  it("agrupa días distintos de la misma semana en la misma clave", () => {
    // martes y miércoles de la misma semana
    const tue = weekKey(new Date(2026, 4, 5));
    const wed = weekKey(new Date(2026, 4, 6));
    expect(tue).toBe(wed);
  });
});

describe("monthKey", () => {
  it("retorna YYYY-MM con padding", () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
});

describe("DAY_OF_WEEK", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("mapea domingo (idx 0) al final de la semana", () => {
    vi.setSystemTime(new Date("2026-05-10T12:00:00")); // domingo
    expect(DAY_OF_WEEK()).toBe("domingo");
  });

  it("mapea lunes al inicio", () => {
    vi.setSystemTime(new Date("2026-05-04T12:00:00")); // lunes
    expect(DAY_OF_WEEK()).toBe("lunes");
  });

  it("mapea miércoles correctamente", () => {
    vi.setSystemTime(new Date("2026-05-06T12:00:00")); // miércoles
    expect(DAY_OF_WEEK()).toBe("miercoles");
  });
});

describe("isNightTime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("es noche a las 22h", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 22));
    expect(isNightTime()).toBe(true);
  });

  it("es noche a las 03h", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 3));
    expect(isNightTime()).toBe(true);
  });

  it("es día a las 8h", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 8));
    expect(isNightTime()).toBe(false);
  });

  it("es día a las 19h (justo antes del corte)", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 19));
    expect(isNightTime()).toBe(false);
  });

  it("es noche en el límite de las 20h", () => {
    vi.setSystemTime(new Date(2026, 4, 7, 20));
    expect(isNightTime()).toBe(true);
  });
});
