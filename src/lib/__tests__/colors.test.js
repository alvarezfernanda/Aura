import { describe, it, expect } from "vitest";
import { mixColors } from "../colors.js";

describe("mixColors", () => {
  it("mezcla 50/50 dos colores hex", () => {
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("retorna el primer color con ratio 0", () => {
    expect(mixColors("#ff0000", "#00ff00", 0)).toBe("#ff0000");
  });

  it("retorna el segundo color con ratio 1", () => {
    expect(mixColors("#ff0000", "#00ff00", 1)).toBe("#00ff00");
  });

  it("usa 0.5 como ratio default", () => {
    expect(mixColors("#000000", "#ffffff")).toBe("#808080");
  });

  it("trata input no-string como #000000", () => {
    expect(mixColors(null, "#ffffff", 0)).toBe("#000000");
    expect(mixColors(undefined, "#ffffff", 1)).toBe("#ffffff");
  });

  it("trata hex de longitud incorrecta como #000000", () => {
    expect(mixColors("#fff", "#ffffff", 0)).toBe("#000000");
  });

  it("acepta hex sin #", () => {
    expect(mixColors("ffffff", "000000", 0)).toBe("#ffffff");
  });

  it("conserva canales separados", () => {
    // mezcla 50/50 de #ff0000 (rojo) y #0000ff (azul) = #800080 (púrpura)
    expect(mixColors("#ff0000", "#0000ff", 0.5)).toBe("#800080");
  });
});
