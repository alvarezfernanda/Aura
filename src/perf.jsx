// Aura — utilidades de rendimiento para Android / PWA
import { useEffect, useState, useRef, useCallback, useMemo } from "react";

/* ------------------------------------------------------------------
   Detección de capacidades del dispositivo
------------------------------------------------------------------ */

export function isLowEndDevice() {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const conn = navigator.connection || {};
  const slowNet =
    conn.saveData === true ||
    conn.effectiveType === "slow-2g" ||
    conn.effectiveType === "2g" ||
    conn.effectiveType === "3g";
  return cores <= 4 || mem <= 2 || slowNet;
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

export function useIsMobile(maxWidth = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth <= maxWidth;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setIsMobile(window.innerWidth <= maxWidth));
    };
    window.addEventListener("resize", check, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", check);
    };
  }, [maxWidth]);
  return isMobile;
}

/* ------------------------------------------------------------------
   Hooks de optimización
------------------------------------------------------------------ */

export function useDebounce(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useThrottledCallback(fn, ms = 100) {
  const last = useRef(0);
  const timer = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    const remaining = ms - (now - last.current);
    if (remaining <= 0) {
      last.current = now;
      fn(...args);
    } else {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        last.current = Date.now();
        fn(...args);
      }, remaining);
    }
  }, [fn, ms]);
}

/* ------------------------------------------------------------------
   Carga diferida de chunks por ruta — utilidad genérica
------------------------------------------------------------------ */
export function lazyWithRetry(loader, retries = 2) {
  return () =>
    new Promise((resolve, reject) => {
      const attempt = (n) => {
        loader()
          .then(resolve)
          .catch((err) => {
            if (n <= 0) reject(err);
            else setTimeout(() => attempt(n - 1), 600);
          });
      };
      attempt(retries);
    });
}

/* ------------------------------------------------------------------
   VirtualList — lista virtualizada con altura fija
   Renderiza sólo las filas visibles + un buffer.
------------------------------------------------------------------ */
import React from "react";

export function VirtualList({
  items,
  rowHeight = 64,
  height = 480,
  overscan = 4,
  renderItem,
  getKey,
  emptyMessage = null,
  style = {},
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const total = items.length;
  const visibleCount = Math.ceil(height / rowHeight);
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIdx = Math.min(total, startIdx + visibleCount + overscan * 2);

  const slice = useMemo(
    () => items.slice(startIdx, endIdx),
    [items, startIdx, endIdx]
  );

  const totalHeight = total * rowHeight;
  const offsetY = startIdx * rowHeight;

  if (total === 0 && emptyMessage) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", opacity: 0.6, ...style }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        position: "relative",
        height,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        contain: "strict",
        ...style,
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, i) => {
            const idx = startIdx + i;
            return (
              <div
                key={getKey ? getKey(item, idx) : idx}
                style={{ height: rowHeight }}
              >
                {renderItem(item, idx)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
