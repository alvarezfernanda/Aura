import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useClaudeCoach, COACH_SYSTEM } from "../useClaudeCoach.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterEach(() => {
  cleanup();
  delete global.fetch;
});

describe("useClaudeCoach", () => {
  it("retorna { ask, loading=false } al montar", () => {
    const { result } = renderHook(() => useClaudeCoach());
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.ask).toBe("function");
  });

  it("envía POST a /api/claude con system y user message", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: "text", text: "respuesta" }] }),
    });

    const { result } = renderHook(() => useClaudeCoach());
    await act(async () => {
      await result.current.ask("¿qué hago hoy?");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/claude");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(opts.body);
    expect(body.system).toBe(COACH_SYSTEM);
    expect(body.messages).toEqual([{ role: "user", content: "¿qué hago hoy?" }]);
  });

  it("acepta systemContext personalizado", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    const { result } = renderHook(() => useClaudeCoach());
    await act(async () => {
      await result.current.ask("hola", "Eres un asistente custom");
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe("Eres un asistente custom");
  });

  it("filtra solo content blocks de tipo 'text' y los une con \\n", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        content: [
          { type: "text", text: "primera línea" },
          { type: "tool_use", text: "se ignora" },
          { type: "text", text: "segunda línea" },
        ],
      }),
    });
    const { result } = renderHook(() => useClaudeCoach());
    let ret;
    await act(async () => {
      ret = await result.current.ask("test");
    });
    expect(ret).toBe("primera línea\nsegunda línea");
  });

  it("retorna '' (string vacío) si content es undefined", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({}) });
    const { result } = renderHook(() => useClaudeCoach());
    let ret;
    await act(async () => {
      ret = await result.current.ask("test");
    });
    expect(ret).toBe("");
  });

  it("retorna null si fetch lanza", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useClaudeCoach());
    let ret;
    await act(async () => {
      ret = await result.current.ask("test");
    });
    expect(ret).toBeNull();
  });

  it("retorna null si .json() lanza", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => {
        throw new Error("parse");
      },
    });
    const { result } = renderHook(() => useClaudeCoach());
    let ret;
    await act(async () => {
      ret = await result.current.ask("test");
    });
    expect(ret).toBeNull();
  });

  it("loading sube a true durante fetch y vuelve a false al terminar", async () => {
    let resolveFetch;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = () =>
          resolve({ json: async () => ({ content: [{ type: "text", text: "x" }] }) });
      })
    );
    const { result } = renderHook(() => useClaudeCoach());
    let askPromise;
    act(() => {
      askPromise = result.current.ask("test");
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolveFetch();
      await askPromise;
    });
    expect(result.current.loading).toBe(false);
  });

  it("loading vuelve a false también en error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useClaudeCoach());
    await act(async () => {
      await result.current.ask("test");
    });
    expect(result.current.loading).toBe(false);
  });
});
