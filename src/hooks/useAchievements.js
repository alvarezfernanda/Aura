import { useState, useEffect, useMemo, useCallback } from "react";
import { useStorage } from "./useStorage.js";
import { ACHIEVEMENTS } from "../lib/achievements.js";
import { calcCyclePhase } from "../lib/cycle.js";

// Hook que evalúa los logros de la usuaria a partir de su estado actual.
// Persiste los desbloqueados con useStorage y mantiene una cola de "reveals"
// (medallas pendientes de mostrar al usuario). Llamar dismissCurrentReveal
// avanza la cola.
export function useAchievements({
  streak,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  bodyMetrics,
  painLog,
  cycleHistory,
  lastPeriod,
  cycleType,
}) {
  const [unlocked, setUnlocked] = useStorage("aura-achievements-v1", {});
  const [revealQueue, setRevealQueue] = useState([]);

  const ctx = useMemo(() => {
    const totalSessions =
      (Array.isArray(sesionesGym) ? sesionesGym.length : 0) +
      (Array.isArray(sesionesPilates) ? sesionesPilates.length : 0) +
      (Array.isArray(sesionesCuello) ? sesionesCuello.length : 0);

    const safeBody = bodyMetrics && typeof bodyMetrics === "object" ? bodyMetrics : {};
    const hasJournaled = Array.isArray(safeBody.journal) && safeBody.journal.length > 0;

    const painLogCount = Array.isArray(painLog) ? painLog.length : 0;

    const phasesObserved = Array.isArray(cycleHistory)
      ? new Set(cycleHistory.map((e) => e.phase).filter(Boolean)).size
      : 0;

    const periodsLogged = Array.isArray(cycleHistory)
      ? cycleHistory.filter((e) => e.type === "period" || e.isPeriod).length
      : lastPeriod ? 1 : 0;

    let trainedInOvulation = false;
    let restedInLuteal = false;

    if (lastPeriod && Array.isArray(sesionesGym)) {
      try {
        for (const s of sesionesGym) {
          const sd = typeof s === "string" ? s : s.date;
          if (!sd) continue;
          const info = calcCyclePhase(lastPeriod, 28, cycleType || "regular", sd);
          if (info?.data?.name?.toLowerCase?.().includes("ovul")) {
            trainedInOvulation = true;
            break;
          }
        }
      } catch (e) {}
    }

    if (lastPeriod) {
      try {
        const today = new Date();
        for (let i = 0; i < 14; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const ds = d.toISOString().slice(0, 10);
          const info = calcCyclePhase(lastPeriod, 28, cycleType || "regular", ds);
          const name = info?.data?.name?.toLowerCase?.();
          if (name && (name.includes("lút") || name.includes("lute"))) {
            const trainedThisDay =
              (Array.isArray(sesionesGym) &&
                sesionesGym.some((s) => (typeof s === "string" ? s : s.date) === ds)) ||
              (Array.isArray(sesionesPilates) &&
                sesionesPilates.some((s) => (typeof s === "string" ? s : s.date) === ds));
            if (!trainedThisDay) {
              restedInLuteal = true;
              break;
            }
          }
        }
      } catch (e) {}
    }

    return {
      streak: streak || 0,
      totalSessions,
      hasJournaled,
      painLogCount,
      phasesObserved,
      periodsLogged,
      trainedInOvulation,
      restedInLuteal,
    };
  }, [streak, sesionesGym, sesionesPilates, sesionesCuello, bodyMetrics, painLog, cycleHistory, lastPeriod, cycleType]);

  useEffect(() => {
    const currentUnlocked = unlocked || {};
    const newly = [];
    for (const ach of ACHIEVEMENTS) {
      if (!currentUnlocked[ach.id] && ach.check(ctx)) {
        newly.push(ach);
      }
    }
    if (newly.length > 0) {
      const updated = { ...currentUnlocked };
      newly.forEach((ach) => {
        updated[ach.id] = { unlockedAt: new Date().toISOString() };
      });
      setUnlocked(updated);
      setRevealQueue((q) => [...q, ...newly]);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate([40, 80, 40]); } catch (e) {}
      }
    }
  }, [ctx]);

  const dismissCurrentReveal = useCallback(() => {
    setRevealQueue((q) => q.slice(1));
  }, []);

  return {
    unlocked: unlocked || {},
    currentReveal: revealQueue[0] || null,
    revealCount: revealQueue.length,
    dismissCurrentReveal,
    allAchievements: ACHIEVEMENTS,
    ctx,
  };
}
