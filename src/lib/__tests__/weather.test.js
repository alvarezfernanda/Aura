import { describe, it, expect } from "vitest";
import { decodeWeather, getWeatherSuggestion } from "../weather.js";

describe("decodeWeather — códigos WMO", () => {
  it("0 = despejado", () => {
    expect(decodeWeather(0).mood).toBe("clear");
  });

  it("1..3 = parcialmente nublado", () => {
    expect(decodeWeather(2).mood).toBe("partly");
  });

  it("4..48 = brumoso", () => {
    expect(decodeWeather(45).mood).toBe("foggy");
  });

  it("49..57 = llovizna", () => {
    expect(decodeWeather(53).mood).toBe("drizzle");
  });

  it("58..67 = lluvia", () => {
    expect(decodeWeather(63).mood).toBe("rainy");
  });

  it("68..77 = nieve", () => {
    expect(decodeWeather(73).mood).toBe("snowy");
  });

  it("78..82 = chubascos", () => {
    expect(decodeWeather(81).mood).toBe("showers");
  });

  it("83..99 = tormenta", () => {
    expect(decodeWeather(95).mood).toBe("storm");
  });

  it("100+ = label vacío, mood clear", () => {
    expect(decodeWeather(150)).toMatchObject({ label: "", mood: "clear" });
  });

  it("incluye label, icon, mood, particles", () => {
    const r = decodeWeather(0);
    expect(r).toHaveProperty("label");
    expect(r).toHaveProperty("icon");
    expect(r).toHaveProperty("mood");
    expect(r).toHaveProperty("particles");
  });
});

describe("getWeatherSuggestion", () => {
  it("retorna null si no hay weather", () => {
    expect(getWeatherSuggestion(null, "lunes")).toBeNull();
  });

  it("lluvia + día de gym (lunes/miercoles/viernes) sugiere alternativa", () => {
    const r = getWeatherSuggestion({ code: 63, temp: 22 }, "lunes");
    expect(r).toMatch(/lluvioso/i);
    expect(r).toMatch(/cambio de ropa/i);
  });

  it("lluvia + día de Pilates (martes/jueves/sabado/domingo)", () => {
    const r = getWeatherSuggestion({ code: 63, temp: 22 }, "martes");
    expect(r).toMatch(/Pilates en casa/i);
  });

  it("calor extremo (≥32°)", () => {
    const r = getWeatherSuggestion({ code: 0, temp: 33 }, "lunes");
    expect(r).toMatch(/Calor intenso/);
  });

  it("temperatura alta (28-31°)", () => {
    const r = getWeatherSuggestion({ code: 0, temp: 29 }, "lunes");
    expect(r).toMatch(/Temperatura alta/);
  });

  it("frío (≤15°)", () => {
    const r = getWeatherSuggestion({ code: 0, temp: 14 }, "lunes");
    expect(r).toMatch(/Fresco/);
  });

  it("clima ideal (despejado, 20-28°)", () => {
    const r = getWeatherSuggestion({ code: 0, temp: 24 }, "lunes");
    expect(r).toMatch(/Clima ideal/);
  });

  it("retorna null para temperaturas medias sin condición especial", () => {
    // Nublado a 18° — no calor, no frío, no lluvia, no clear
    const r = getWeatherSuggestion({ code: 2, temp: 18 }, "lunes");
    expect(r).toBeNull();
  });
});
