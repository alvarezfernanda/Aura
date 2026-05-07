import { useState, useEffect, useCallback } from "react";

// Persistencia con dos backends:
//  - window.storage (entorno Claude.ai, async)
//  - window.localStorage (navegador, síncrono)
// SSR-safe: si no hay window, conserva initialValue.
export function useStorage(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") return;
        if (window.storage && typeof window.storage.get === "function") {
          const res = await window.storage.get(key);
          if (res && res.value) setValue(JSON.parse(res.value));
          return;
        }
        if (window.localStorage) {
          const raw = window.localStorage.getItem(key);
          if (raw !== null && raw !== undefined) {
            setValue(JSON.parse(raw));
          }
        }
      } catch (e) {}
    })();
  }, [key]);

  const save = useCallback(async (newValOrFn) => {
    setValue((prev) => {
      const newVal = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      try {
        if (typeof window !== "undefined") {
          if (window.storage && typeof window.storage.set === "function") {
            window.storage.set(key, JSON.stringify(newVal)).catch(() => {});
          } else if (window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(newVal));
          }
        }
      } catch (e) {}
      return newVal;
    });
  }, [key]);

  return [value, save];
}
