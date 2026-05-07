// Aura — Timeline visual del ciclo (últimos N días) con eventos por día
import React, { useMemo } from "react";
import { useVoiceNotes } from "./voiceNotes.jsx";
import {
  T, FONT_SERIF, FONT_SANS, SHADOW_CARD,
  TAG_LABELS, TAG_COLORS, PHASE_COLORS,
} from "./theme.js";
import { VirtualList } from "./perf.jsx";

const DAY_MS = 86400000;

const isoDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

const PHASE_LABEL = {
  menstrual: "Menstrual",
  folicular: "Folicular",
  ovulatoria: "Ovulatoria",
  lutea: "Lútea",
  unknown: "Sin determinar",
};

/* ------------------------------------------------------------------
   Calcular la fase de UN día dado su histórico de períodos
------------------------------------------------------------------ */
function phaseForDate(dateStr, periodStarts, avgCycleLen, cycleType) {
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;

  const sortedStarts = [...periodStarts]
    .filter(Boolean)
    .map((d) => new Date(d + "T00:00:00"))
    .filter((d) => !isNaN(d.getTime()) && d <= target)
    .sort((a, b) => b - a);

  const last = sortedStarts[0];
  if (!last) return { phase: "unknown", day: null };

  const day = Math.floor((target - last) / DAY_MS) + 1;

  if (cycleType === "irregular") {
    if (day <= 5) return { phase: "menstrual", day };
    return { phase: "unknown", day };
  }

  const len = avgCycleLen || 28;
  const dayOfCycle = ((day - 1) % len) + 1;
  let phase;
  if (dayOfCycle <= 5) phase = "menstrual";
  else if (dayOfCycle <= 13) phase = "folicular";
  else if (dayOfCycle <= 16) phase = "ovulatoria";
  else phase = "lutea";
  return { phase, day: dayOfCycle };
}

/* ------------------------------------------------------------------
   Construye los días del timeline + sus eventos
   Devuelve array (más reciente primero) de:
     { date, phase, dayOfCycle, isPeriodStart, events: [{type, label, color}] }
------------------------------------------------------------------ */
function buildTimeline({
  notes,
  historialEj,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  painLog,
  cycleHistory,
  cycleType,
  days = 60,
  workoutMap = {},
}) {
  // Indexamos eventos por fecha para no recorrer arrays N veces
  const eventsByDate = new Map();
  const push = (date, ev) => {
    if (!date) return;
    if (!eventsByDate.has(date)) eventsByDate.set(date, []);
    eventsByDate.get(date).push(ev);
  };

  if (Array.isArray(notes)) {
    for (const n of notes) push(n.date, {
      type: "note",
      label: (n.text || "").slice(0, 80),
      color: T.plum,
      tags: n.tags,
    });
  }

  if (historialEj && typeof historialEj === "object") {
    for (const exId of Object.keys(historialEj)) {
      const list = historialEj[exId] || [];
      const meta = workoutMap[exId] || {};
      for (const s of list) {
        push(s.date, {
          type: "gym",
          label: meta.name || exId,
          color: T.accentDeep,
        });
      }
    }
  }

  if (Array.isArray(sesionesGym)) {
    for (const s of sesionesGym) push(s?.date, {
      type: "gym",
      label: `Gym${s?.day ? " · " + s.day : ""}`,
      color: T.accentDeep,
    });
  }

  if (Array.isArray(sesionesPilates)) {
    for (const s of sesionesPilates) {
      const date = typeof s === "string" ? s : s?.date;
      const routine = typeof s === "string" ? null : s?.routine;
      push(date, {
        type: "pilates",
        label: `Pilates${routine ? " · " + routine : ""}`,
        color: T.success,
      });
    }
  }

  if (Array.isArray(sesionesCuello)) {
    for (const d of sesionesCuello) push(d, {
      type: "cuello",
      label: "Cuello",
      color: T.gold,
    });
  }

  if (Array.isArray(painLog)) {
    for (const p of painLog) push(p?.date, {
      type: "pain",
      label: `Dolor · ${p?.area || "general"}${p?.intensity ? ` (${p.intensity}/10)` : ""}`,
      color: T.warn,
    });
  }

  // Promedio de longitud del ciclo desde cycleHistory
  const periodStarts = Array.isArray(cycleHistory) ? cycleHistory : [];
  let avgLen = 28;
  if (periodStarts.length >= 2) {
    const sorted = [...periodStarts].sort();
    const diffs = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(sorted[i - 1] + "T00:00:00");
      const b = new Date(sorted[i] + "T00:00:00");
      const d = Math.round((b - a) / DAY_MS);
      if (d > 15 && d < 60) diffs.push(d);
    }
    if (diffs.length) avgLen = Math.round(diffs.reduce((s, x) => s + x, 0) / diffs.length);
  }

  const periodSet = new Set(periodStarts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const dateStr = isoDay(d);
    const ph = phaseForDate(dateStr, periodStarts, avgLen, cycleType || "regular");
    out.push({
      date: dateStr,
      phase: ph?.phase || "unknown",
      dayOfCycle: ph?.day || null,
      isPeriodStart: periodSet.has(dateStr),
      events: eventsByDate.get(dateStr) || [],
      isToday: i === 0,
    });
  }
  return out;
}

/* ------------------------------------------------------------------
   UI — Day row (memoized)
------------------------------------------------------------------ */
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fmtDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
  } catch { return dateStr; }
}

function DayRow({ day }) {
  const phaseColor = PHASE_COLORS[day.phase] || T.inkSoft;
  return (
    <div style={{
      display: "flex", gap: 12,
      padding: "10px 0",
      borderBottom: `1px solid ${T.lineSoft}`,
      alignItems: "stretch",
    }}>
      {/* Gutter de fase */}
      <div style={{
        width: 4, alignSelf: "stretch",
        background: phaseColor,
        borderRadius: 2,
        opacity: day.events.length ? 1 : 0.55,
      }} />

      {/* Día + número de ciclo */}
      <div style={{
        width: 56, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <div style={{
          fontSize: 11, color: T.inkSoft,
          letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600,
        }}>{fmtDate(day.date)}</div>
        {day.dayOfCycle && (
          <div style={{
            fontSize: 10, color: phaseColor,
            fontWeight: 700, marginTop: 2,
          }}>
            d{day.dayOfCycle}{day.isPeriodStart ? " ●" : ""}
          </div>
        )}
        {day.isToday && (
          <div style={{
            fontSize: 9, color: T.accentDeep, fontWeight: 700,
            letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2,
          }}>Hoy</div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, color: phaseColor,
          fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
          marginBottom: 4,
        }}>{PHASE_LABEL[day.phase]}</div>
        {day.events.length === 0 ? (
          <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: "italic", opacity: 0.55 }}>
            sin eventos
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {day.events.map((ev, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: T.ink,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: ev.color, flexShrink: 0,
                }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ev.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MemoDayRow = React.memo(DayRow);

/* ------------------------------------------------------------------
   Mini banda visual: distribución de fases en los últimos N días
------------------------------------------------------------------ */
function PhaseBar({ days }) {
  const counts = useMemo(() => {
    const c = { menstrual: 0, folicular: 0, ovulatoria: 0, lutea: 0, unknown: 0 };
    for (const d of days) c[d.phase] = (c[d.phase] || 0) + 1;
    return c;
  }, [days]);

  const total = days.length || 1;
  const order = ["menstrual", "folicular", "ovulatoria", "lutea", "unknown"];

  return (
    <div>
      <div style={{
        display: "flex", height: 10, borderRadius: 6, overflow: "hidden",
        border: `1px solid ${T.lineSoft}`, marginBottom: 8,
      }}>
        {order.map((ph) => {
          const w = (counts[ph] / total) * 100;
          if (w === 0) return null;
          return (
            <div key={ph} style={{
              width: `${w}%`,
              background: PHASE_COLORS[ph],
              opacity: ph === "unknown" ? 0.35 : 1,
            }} title={`${PHASE_LABEL[ph]} · ${counts[ph]} días`} />
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {order.filter((p) => counts[p] > 0).map((ph) => (
          <div key={ph} style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 10, color: T.inkSoft, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: PHASE_COLORS[ph], opacity: ph === "unknown" ? 0.35 : 1,
            }} />
            {PHASE_LABEL[ph]} · {counts[ph]}d
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Página
------------------------------------------------------------------ */
export default function CycleTimelinePage({
  historialEj,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  painLog,
  cycleHistory,
  lastPeriod,
  cycleType,
  workoutMap,
  onBack,
  days: daysProp,
}) {
  const { notes } = useVoiceNotes();

  // Si el ciclo no está registrado todavía, sembramos un período con lastPeriod
  const periodSeed = useMemo(() => {
    const arr = Array.isArray(cycleHistory) ? [...cycleHistory] : [];
    if (lastPeriod && !arr.includes(lastPeriod)) arr.push(lastPeriod);
    return arr;
  }, [cycleHistory, lastPeriod]);

  const days = useMemo(() => buildTimeline({
    notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
    painLog, cycleHistory: periodSeed, cycleType, workoutMap,
    days: daysProp || 60,
  }), [notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
       painLog, periodSeed, cycleType, workoutMap, daysProp]);

  const eventCount = useMemo(() => days.reduce((s, d) => s + d.events.length, 0), [days]);

  return (
    <div style={{ fontFamily: FONT_SANS, color: T.ink, paddingBottom: 16 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "transparent", border: "none", color: T.inkMid,
            fontSize: 13, padding: "4px 0", marginBottom: 8, cursor: "pointer",
            fontFamily: FONT_SANS,
          }}
          aria-label="Volver"
        >
          ← Volver
        </button>
      )}

      <h1 style={{
        fontFamily: FONT_SERIF, fontWeight: 500, fontSize: 32,
        margin: "8px 0 4px", letterSpacing: 0.2,
      }}>Línea de tiempo</h1>
      <p style={{ color: T.inkSoft, fontSize: 14, margin: "0 0 18px" }}>
        Tus últimos {days.length} días, agrupados por fase del ciclo.
      </p>

      <div style={{
        background: T.cardGlass,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        boxShadow: SHADOW_CARD,
      }}>
        <div style={{
          fontSize: 11, color: T.inkSoft, letterSpacing: 0.6,
          textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
        }}>
          Distribución de fases · {eventCount} eventos
        </div>
        <PhaseBar days={days} />
      </div>

      {days.length > 30 ? (
        <VirtualList
          items={days}
          rowHeight={84}
          height={520}
          getKey={(d) => d.date}
          renderItem={(d) => <MemoDayRow day={d} />}
        />
      ) : (
        <div>
          {days.map((d) => <MemoDayRow key={d.date} day={d} />)}
        </div>
      )}
    </div>
  );
}
