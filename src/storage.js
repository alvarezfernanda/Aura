// Aura — capa de almacenamiento unificada (window.storage en Claude.ai, localStorage en navegador)
import { useCallback, useEffect, useState, useRef } from "react";

const isClient = () => typeof window !== "undefined";
const hasWindowStorage = () =>
  isClient() && window.storage && typeof window.storage.get === "function";

export async function storageGet(key, fallback = null) {
  if (!isClient()) return fallback;
  try {
    if (hasWindowStorage()) {
      const res = await window.storage.get(key);
      if (res && res.value != null) return JSON.parse(res.value);
      return fallback;
    }
    if (window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    }
  } catch (e) {
    return fallback;
  }
  return fallback;
}

export async function storageSet(key, value) {
  if (!isClient()) return;
  try {
    const serialized = JSON.stringify(value);
    if (hasWindowStorage()) {
      await window.storage.set(key, serialized);
      return;
    }
    if (window.localStorage) window.localStorage.setItem(key, serialized);
  } catch (e) {}
}

/**
 * useStorage — Hook con escritura optimista + persistencia diferida (debounced).
 * Acepta (key, initialValue, options).
 *   options.debounceMs — agrupa escrituras rápidas (default 200 ms).
 */
export function useStorage(key, initialValue, options = {}) {
  const { debounceMs = 200 } = options;
  const [value, setValue] = useState(initialValue);
  const loadedRef = useRef(false);
  const writeTimer = useRef(0);
  const pendingValue = useRef(initialValue);

  useEffect(() => {
    let cancelled = false;
    storageGet(key, initialValue).then((v) => {
      if (cancelled) return;
      loadedRef.current = true;
      if (v != null) setValue(v);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = useCallback((newValOrFn) => {
    setValue((prev) => {
      const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      pendingValue.current = next;
      clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        storageSet(key, pendingValue.current);
      }, debounceMs);
      return next;
    });
  }, [key, debounceMs]);

  // Flush al desmontar
  useEffect(() => () => {
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      storageSet(key, pendingValue.current);
    }
  }, [key]);

  return [value, save, loadedRef];
}
