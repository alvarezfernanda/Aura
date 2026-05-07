import { useMemo, useCallback } from "react";
import { useStorage } from "./useStorage.js";
import { calcCyclePhase } from "../lib/cycle.js";

// Reminders contextuales — mensajes que aparecen sólo cuando el contexto
// los justifica. Cada uno tiene un check(ctx) y un build(ctx) que produce
// el contenido. dismissHours controla cuánto tiempo se oculta tras
// descartar (ver dismissReminder).
export const CONTEXTUAL_REMINDERS = [
  {
    id: "welcome_period",
    priority: 1,
    tone: "care",
    dismissHours: 24,
    check: (ctx) => {
      if (!ctx.lastPeriod) return false;
      const today = new Date().toISOString().slice(0, 10);
      return ctx.lastPeriod === today;
    },
    build: () => ({
      title: "Hoy empezó tu ciclo",
      body: "El cuerpo pidió reposo. Escucharlo ya es trabajo.",
      cta: null,
    }),
  },
  {
    id: "body_silence",
    priority: 2,
    tone: "invitation",
    dismissHours: 24,
    check: (ctx) => {
      const daysSincePain = ctx.daysSinceLastPainLog;
      const daysSinceJournal = ctx.daysSinceLastJournal;
      if (daysSincePain === null && daysSinceJournal === null) return false;
      const silent = Math.min(
        daysSincePain ?? Infinity,
        daysSinceJournal ?? Infinity
      );
      return silent >= 3 && silent < 30;
    },
    build: () => ({
      title: "Un momento para escucharte",
      body: "Hace unos días que no registrás cómo te sentís. No es urgencia — es invitación.",
      cta: null,
    }),
  },
  {
    id: "luteal_gentleness",
    priority: 3,
    tone: "care",
    dismissHours: 48,
    check: (ctx) =>
      ctx.cyclePhaseName?.toLowerCase?.().includes("lút") ||
      ctx.cyclePhaseName?.toLowerCase?.().includes("lute"),
    build: () => ({
      title: "Estás en fase lútea",
      body: "Tu cuerpo prepara un descanso. Quizá hoy lo honremos.",
      cta: null,
    }),
  },
  {
    id: "near_streak_unlock",
    priority: 2,
    tone: "celebration",
    dismissHours: 12,
    check: (ctx) => ctx.streak === 6 || ctx.streak === 29,
    build: (ctx) => {
      if (ctx.streak === 6) {
        return {
          title: "Un día más y echás Raíz Firme",
          body: "Siete días seguidos. Lo pequeño se vuelve forma.",
          cta: null,
        };
      }
      return {
        title: "Mañana son Nueve Lunas",
        body: "Treinta días habitando el cuerpo. Un ciclo completo de presencia.",
        cta: null,
      };
    },
  },
  {
    id: "season_transition",
    priority: 2,
    tone: "information",
    dismissHours: 72,
    check: (ctx) => {
      if (!ctx.season) return false;
      return ctx.season.daysLeftInSeason >= 0 && ctx.season.daysLeftInSeason <= 2;
    },
    build: (ctx) => {
      const current = ctx.season?.name || "";
      const next =
        current === "Raíz" ? "Bloom" : current === "Bloom" ? "Quietud" : "Raíz";
      return {
        title: `Se cierra tu ${current}`,
        body: ctx.season?.nextHint || `Pronto entrás en ${next}.`,
        cta: null,
      };
    },
  },
  {
    id: "first_day",
    priority: 1,
    tone: "invitation",
    dismissHours: 999 * 24,
    check: (ctx) => ctx.season?.daysSince === 1,
    build: () => ({
      title: "Bienvenida a Aura",
      body: "Esto no es una app para medir. Es un espacio para habitarte.",
      cta: null,
    }),
  },
];

export function useContextualReminders({
  painLog,
  bodyMetrics,
  streak,
  lastPeriod,
  cycleType,
  season,
}) {
  const [dismissed, setDismissed] = useStorage("aura-reminders-dismissed", {});

  const ctx = useMemo(() => {
    const today = new Date();

    let daysSinceLastPainLog = null;
    if (Array.isArray(painLog) && painLog.length > 0) {
      const latest = [...painLog].sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      )[0];
      if (latest?.date) {
        const d = new Date(latest.date);
        daysSinceLastPainLog = Math.floor((today - d) / 86400000);
      }
    }

    let daysSinceLastJournal = null;
    const safeBody = bodyMetrics && typeof bodyMetrics === "object" ? bodyMetrics : {};
    if (Array.isArray(safeBody.journal) && safeBody.journal.length > 0) {
      const latest = [...safeBody.journal].sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      )[0];
      if (latest?.date) {
        const d = new Date(latest.date);
        daysSinceLastJournal = Math.floor((today - d) / 86400000);
      }
    }

    let cyclePhaseName = null;
    if (lastPeriod) {
      try {
        const info = calcCyclePhase(lastPeriod, 28, cycleType || "regular");
        cyclePhaseName = info?.data?.name || null;
      } catch (e) {}
    }

    return {
      streak: streak || 0,
      lastPeriod,
      cyclePhaseName,
      daysSinceLastPainLog,
      daysSinceLastJournal,
      season,
    };
  }, [painLog, bodyMetrics, streak, lastPeriod, cycleType, season]);

  const reminders = useMemo(() => {
    const now = Date.now();
    return CONTEXTUAL_REMINDERS.filter((r) => {
      const dismissedAt = dismissed?.[r.id];
      if (dismissedAt) {
        const hoursSinceDismiss = (now - dismissedAt) / 3600000;
        if (hoursSinceDismiss < r.dismissHours) return false;
      }
      try {
        return r.check(ctx);
      } catch (e) {
        return false;
      }
    })
      .sort((a, b) => a.priority - b.priority)
      .map((r) => {
        try {
          return { ...r, ...r.build(ctx) };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
  }, [ctx, dismissed]);

  const dismissReminder = useCallback(
    (id) => {
      setDismissed((prev) => ({ ...(prev || {}), [id]: Date.now() }));
    },
    [setDismissed]
  );

  return {
    reminders,
    topReminder: reminders[0] || null,
    dismissReminder,
  };
}
