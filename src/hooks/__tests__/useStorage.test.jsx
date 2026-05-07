import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStorage } from "../useStorage.js";

describe("useStorage — backend localStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Asegurar que window.storage no existe
    delete window.storage;
  });

  it("retorna initialValue cuando localStorage está vacío", () => {
    const { result } = renderHook(() => useStorage("aura-test", { foo: "bar" }));
    expect(result.current[0]).toEqual({ foo: "bar" });
  });

  it("hidrata desde localStorage al montar", async () => {
    window.localStorage.setItem("aura-test", JSON.stringify({ stored: true }));
    const { result } = renderHook(() => useStorage("aura-test", null));
    await waitFor(() => expect(result.current[0]).toEqual({ stored: true }));
  });

  it("hidrata SÍNCRONAMENTE en el primer render (sin useEffect)", () => {
    // Crítico para evitar race con consumidores como useAchievements.
    window.localStorage.setItem("aura-sync", JSON.stringify("sync-val"));
    const { result } = renderHook(() => useStorage("aura-sync", "default"));
    expect(result.current[0]).toBe("sync-val");
  });

  it("save() persiste en localStorage", async () => {
    const { result } = renderHook(() => useStorage("aura-test", []));
    await act(async () => {
      await result.current[1]([1, 2, 3]);
    });
    expect(JSON.parse(window.localStorage.getItem("aura-test"))).toEqual([1, 2, 3]);
    expect(result.current[0]).toEqual([1, 2, 3]);
  });

  it("save() acepta función para updates basados en estado previo", async () => {
    window.localStorage.setItem("aura-counter", JSON.stringify(5));
    const { result } = renderHook(() => useStorage("aura-counter", 0));
    await waitFor(() => expect(result.current[0]).toBe(5));

    await act(async () => {
      await result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(6);
    expect(JSON.parse(window.localStorage.getItem("aura-counter"))).toBe(6);
  });

  it("conserva initialValue si el JSON guardado está corrupto", async () => {
    window.localStorage.setItem("aura-test", "{ this is not valid json");
    const { result } = renderHook(() => useStorage("aura-test", { fallback: true }));
    // No debería romperse — el catch silencia y queda el initial
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current[0]).toEqual({ fallback: true });
  });

  it("trata 'null' guardado literalmente como null (no initialValue)", async () => {
    window.localStorage.setItem("aura-test", "null");
    const { result } = renderHook(() => useStorage("aura-test", "default"));
    await waitFor(() => expect(result.current[0]).toBeNull());
  });

  it("guarda strings, números, arrays y objetos", async () => {
    const cases = [
      ["str", "hola"],
      ["num", 42],
      ["arr", [1, 2, 3]],
      ["obj", { a: 1, b: { c: 2 } }],
      ["bool", true],
    ];
    for (const [key, val] of cases) {
      const { result } = renderHook(() => useStorage(`aura-${key}`, null));
      await act(async () => {
        await result.current[1](val);
      });
      expect(JSON.parse(window.localStorage.getItem(`aura-${key}`))).toEqual(val);
    }
  });
});

describe("useStorage — backend window.storage (Claude.ai)", () => {
  let storageMock;

  beforeEach(() => {
    window.localStorage.clear();
    storageMock = {
      data: {},
      get: vi.fn(async (key) => {
        if (key in storageMock.data) return { value: storageMock.data[key] };
        return null;
      }),
      set: vi.fn(async (key, value) => {
        storageMock.data[key] = value;
      }),
    };
    window.storage = storageMock;
  });

  afterEach(() => {
    delete window.storage;
  });

  it("prefiere window.storage cuando está disponible", async () => {
    storageMock.data["aura-test"] = JSON.stringify({ from: "claude" });
    const { result } = renderHook(() => useStorage("aura-test", null));
    await waitFor(() => expect(result.current[0]).toEqual({ from: "claude" }));
    expect(storageMock.get).toHaveBeenCalledWith("aura-test");
  });

  it("save() escribe a window.storage, no a localStorage", async () => {
    const { result } = renderHook(() => useStorage("aura-test", null));
    await act(async () => {
      await result.current[1]({ written: true });
    });
    expect(storageMock.set).toHaveBeenCalledWith(
      "aura-test",
      JSON.stringify({ written: true })
    );
    expect(window.localStorage.getItem("aura-test")).toBeNull();
  });

  it("ignora rechazos del set sin romper el estado", async () => {
    storageMock.set = vi.fn(() => Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useStorage("aura-test", null));
    await act(async () => {
      await result.current[1]("nuevo");
    });
    expect(result.current[0]).toBe("nuevo");
  });

  it("ignora respuesta sin .value", async () => {
    storageMock.get = vi.fn(async () => null);
    const { result } = renderHook(() => useStorage("aura-test", "default"));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current[0]).toBe("default");
  });

  it("ignora errores del get", async () => {
    storageMock.get = vi.fn(() => Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useStorage("aura-test", "default"));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current[0]).toBe("default");
  });
});

describe("useStorage — re-hidratación al cambiar key", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.storage;
  });

  it("vuelve a leer cuando el key cambia", async () => {
    window.localStorage.setItem("k1", JSON.stringify("uno"));
    window.localStorage.setItem("k2", JSON.stringify("dos"));

    const { result, rerender } = renderHook(({ k }) => useStorage(k, "init"), {
      initialProps: { k: "k1" },
    });
    await waitFor(() => expect(result.current[0]).toBe("uno"));

    rerender({ k: "k2" });
    await waitFor(() => expect(result.current[0]).toBe("dos"));
  });
});
