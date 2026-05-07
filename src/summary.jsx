// Aura — Resumen semanal / mensual
import React, { useMemo, useState } from "react";
import { useVoiceNotes } from "./voiceNotes.jsx";
import {
  T, FONT_SERIF, FONT_SANS, SHADOW_CARD,
  TAG_LABELS, TAG_COLORS, PHASE_COLORS,
} from "./theme.js";

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
   Marco temporal (semana / mes)
------------------------------------------------------------------ */
function frameRange(frame) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (frame === "week") {
    const start = new Date(today.getTime() - 6 * DAY_MS);
    return { start, end: today, days: 7, label: "últimos 7 días" };
  }
  const start = new Date(today.getTime() - 29 * DAY_MS);
  return { start, end: today, days: 30, label: "últimos 30 días" };
}

const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  return d >= start && d <= end;
};

/* ------------------------------------------------------------------
   Calcular fase histórica a partir de cycleHistory
------------------------------------------------------------------ */
function phaseForDate(dateStr, periodStarts, avgLen, cycleType) {
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return "unknown";
  const last = [...periodStarts]
    .filter(Boolean)
    .map((d) => new Date(d + "T00:00:00"))
    .filter((d) => !isNaN(d.getTime()) && d <= target)
    .sort((a, b) => b - a)[0];
  if (!last) return "unknown";
  const day = Math.floor((target - last) / DAY_MS) + 1;
  if (cycleType === "irregular") return day <= 5 ? "menstrual" : "unknown";
  const len = avgLen || 28;
  const dayOfCycle = ((day - 1) % len) + 1;
  if (dayOfCycle <= 5) return "menstrual";
  if (dayOfCycle <= 13) return "folicular";
  if (dayOfCycle <= 16) return "ovulatoria";
  return "lutea";
}

/* ------------------------------------------------------------------
   Agregación principal
------------------------------------------------------------------ */
function aggregate({
  frame, notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
  painLog, cycleHistory, cycleType,
}) {
  const { start, end, days, label } = frameRange(frame);

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

  // Contadores por fase
  const phaseCounts = { menstrual: 0, folicular: 0, ovulatoria: 0, lutea: 0, unknown: 0 };
  for (let i = 0; i < days; i++) {
    const d = new Date(end.getTime() - i * DAY_MS);
    const ph = phaseForDate(isoDay(d), periodStarts, avgLen, cycleType || "regular");
    phaseCounts[ph] = (phaseCounts[ph] || 0) + 1;
  }

  // Notas en el rango
  const notesInRange = (Array.isArray(notes) ? notes : []).filter((n) => inRange(n.date, start, end));
  const tagCounts = {};
  for (const n of notesInRange) {
    for (const t of n.tags || ["general"]) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  const notesByPhase = { menstrual: 0, folicular: 0, ovulatoria: 0, lutea: 0, unknown: 0 };
  for (const n of notesInRange) {
    const ph = n.phase || phaseForDate(n.date, periodStarts, avgLen, cycleType || "regular");
    notesByPhase[ph || "unknown"] = (notesByPhase[ph || "unknown"] || 0) + 1;
  }

  // Sesiones
  const gymCount =
    (Array.isArray(sesionesGym) ? sesionesGym : []).filter((s) => inRange(s?.date, start, end)).length;

  const pilatesCount = (Array.isArray(sesionesPilates) ? sesionesPilates : [])
    .map((s) => (typeof s === "string" ? s : s?.date))
    .filter((d) => inRange(d, start, end)).length;

  const cuelloDates = new Set(
    (Array.isArray(sesionesCuello) ? sesionesCuello : []).filter((d) => inRange(d, start, end))
  );
  const cuelloCount = cuelloDates.size;

  // Volumen total de gym desde historialEj (kg · reps)
  let exerciseSets = 0;
  let totalVolume = 0;
  if (historialEj && typeof historialEj === "object") {
    for (const exId of Object.keys(historialEj)) {
      for (const s of historialEj[exId] || []) {
        if (!inRange(s?.date, start, end)) continue;
        for (const set of s?.sets || []) {
          exerciseSets++;
          const w = Number(set.weight) || 0;
          const r = Number(set.reps) || 0;
          totalVolume += w * r;
        }
      }
    }
  }

  // Dolor
  const painsInRange = (Array.isArray(painLog) ? painLog : []).filter((p) => inRange(p?.date, start, end));
  const avgPain = painsInRange.length
    ? painsInRange.reduce((s, p) => s + (Number(p.intensity) || 0), 0) / painsInRange.length
    : null;

  // Días con al menos un evento
  const daySet = new Set();
  for (const n of notesInRange) daySet.add(n.date);
  for (const s of (Array.isArray(sesionesGym) ? sesionesGym : [])) if (inRange(s?.date, start, end)) daySet.add(s.date);
  for (const s of (Array.isArray(sesionesPilates) ? sesionesPilates : [])) {
    const d = typeof s === "string" ? s : s?.date;
    if (inRange(d, start, end)) daySet.add(d);
  }
  for (const d of cuelloDates) daySet.add(d);
  for (const p of painsInRange) daySet.add(p.date);

  return {
    label, days,
    phaseCounts,
    notesCount: notesInRange.length,
    tagCounts,
    notesByPhase,
    gymCount, pilatesCount, cuelloCount,
    exerciseSets, totalVolume,
    avgPain, painCount: painsInRange.length,
    activeDays: daySet.size,
  };
}

/* ------------------------------------------------------------------
   UI helpers
------------------------------------------------------------------ */
function StatCard({ label, value, sub, color = T.accentDeep }) {
  return (
    <div style={{
      background: T.cardGlass,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "12px 14px",
      boxShadow: SHADOW_CARD,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{
        fontSize: 10, color: T.inkSoft, letterSpacing: 0.6,
        textTransform: "uppercase", fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT_SERIF, fontSize: 28, color, fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: T.inkSoft }}>{sub}</div>
      )}
    </div>
  );
}

function PhaseBar({ counts }) {
  const total = Object.values(counts).reduce((s, x) => s + x, 0) || 1;
  const order = ["menstrual", "folicular", "ovulatoria", "lutea", "unknown"];
  return (
    <div>
      <div style={{
        display: "flex", height: 8, borderRadius: 4, overflow: "hidden",
        border: `1px solid ${T.lineSoft}`, marginBottom: 6,
      }}>
        {order.map((ph) => {
          const w = (counts[ph] / total) * 100;
          if (w === 0) return null;
          return (
            <div key={ph} style={{
              width: `${w}%`,
              background: PHASE_COLORS[ph],
              opacity: ph === "unknown" ? 0.35 : 1,
            }} />
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {order.filter((p) => counts[p] > 0).map((ph) => (
          <div key={ph} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 10, color: T.inkSoft, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: PHASE_COLORS[ph], opacity: ph === "unknown" ? 0.35 : 1,
            }} />
            {PHASE_LABEL[ph]} · {counts[ph]}d
          </div>
        ))}
      </div>
    </div>
  );
}

function TagDistribution({ tagCounts }) {
  const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.slice(0, 6).map(([tag, count]) => {
        const pct = (count / total) * 100;
        const color = TAG_COLORS[tag] || T.inkSoft;
        return (
          <div key={tag}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: T.inkMid, fontWeight: 600, marginBottom: 3,
              letterSpacing: 0.3, textTransform: "uppercase",
            }}>
              <span>{TAG_LABELS[tag] || tag}</span>
              <span style={{ color }}>{count}</span>
            </div>
            <div style={{
              height: 6, borderRadius: 3, background: T.lineSoft, overflow: "hidden",
            }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: color,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Página
------------------------------------------------------------------ */
export default function SummaryPage({
  historialEj,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  painLog,
  cycleHistory,
  cycleType,
  onBack,
}) {
  const { notes } = useVoiceNotes();
  const [frame, setFrame] = useState("week");

  const data = useMemo(() => aggregate({
    frame, notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
    painLog, cycleHistory, cycleType,
  }), [frame, notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
       painLog, cycleHistory, cycleType]);

  const consistencyPct = Math.round((data.activeDays / data.days) * 100);

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 4 }}>
        <h1 style={{
          fontFamily: FONT_SERIF, fontWeight: 500, fontSize: 32,
          margin: 0, letterSpacing: 0.2,
        }}>Resumen</h1>
        <div style={{
          display: "inline-flex", padding: 3,
          background: T.cardGlass, borderRadius: 999,
          border: `1px solid ${T.line}`,
        }}>
          {[
            { id: "week", label: "Semana" },
            { id: "month", label: "Mes" },
          ].map((f) => {
            const active = frame === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame(f.id)}
                style={{
                  background: active ? `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})` : "transparent",
                  color: active ? "#fff" : T.inkMid,
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12, fontWeight: 600,
                  letterSpacing: 0.4, textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                }}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <p style={{ color: T.inkSoft, fontSize: 13, margin: "0 0 18px" }}>
        Tus {data.label}.
      </p>

      {/* Stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
        marginBottom: 16,
      }}>
        <StatCard
          label="Días activos"
          value={`${data.activeDays}/${data.days}`}
          sub={`${consistencyPct}% del periodo`}
          color={T.accentDeep}
        />
        <StatCard
          label="Notas"
          value={data.notesCount}
          sub={data.notesCount ? "guardadas" : "ninguna aún"}
          color={T.plum}
        />
        <StatCard
          label="Gym"
          value={data.gymCount}
          sub={data.exerciseSets ? `${data.exerciseSets} sets · ${Math.round(data.totalVolume)} kg·reps` : "sesiones"}
          color={T.accentDeep}
        />
        <StatCard
          label="Pilates · Cuello"
          value={`${data.pilatesCount} · ${data.cuelloCount}`}
          sub="sesiones registradas"
          color={T.success}
        />
        {data.painCount > 0 && (
          <StatCard
            label="Dolor medio"
            value={data.avgPain ? data.avgPain.toFixed(1) : "—"}
            sub={`${data.painCount} registros`}
            color={T.warn}
          />
        )}
      </div>

      {/* Phase distribution */}
      <div style={{
        background: T.cardGlass,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        boxShadow: SHADOW_CARD,
      }}>
        <div style={{
          fontSize: 11, color: T.inkSoft, letterSpacing: 0.6,
          textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
        }}>Distribución de fases</div>
        <PhaseBar counts={data.phaseCounts} />
      </div>

      {/* Tags */}
      {Object.keys(data.tagCounts).length > 0 && (
        <div style={{
          background: T.cardGlass,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
          boxShadow: SHADOW_CARD,
        }}>
          <div style={{
            fontSize: 11, color: T.inkSoft, letterSpacing: 0.6,
            textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
          }}>Tags más frecuentes en notas</div>
          <TagDistribution tagCounts={data.tagCounts} />
        </div>
      )}

      {/* Notas por fase */}
      {data.notesCount > 0 && (
        <div style={{
          background: T.cardGlass,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 14,
          boxShadow: SHADOW_CARD,
        }}>
          <div style={{
            fontSize: 11, color: T.inkSoft, letterSpacing: 0.6,
            textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
          }}>Notas por fase</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.keys(PHASE_LABEL).map((ph) => {
              const v = data.notesByPhase[ph] || 0;
              if (v === 0) return null;
              return (
                <div key={ph} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "8px 14px", borderRadius: 10,
                  background: `${PHASE_COLORS[ph]}15`,
                  border: `1px solid ${PHASE_COLORS[ph]}33`,
                  minWidth: 80,
                }}>
                  <div style={{
                    fontSize: 9, color: PHASE_COLORS[ph], fontWeight: 700,
                    letterSpacing: 0.6, textTransform: "uppercase",
                  }}>{PHASE_LABEL[ph]}</div>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 22, color: PHASE_COLORS[ph],
                    fontVariantNumeric: "tabular-nums",
                  }}>{v}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
