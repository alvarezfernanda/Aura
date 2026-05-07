// Aura — Búsqueda y filtros (notas + sesiones)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useVoiceNotes } from "./voiceNotes.jsx";
import {
  T, FONT_SERIF, FONT_SANS, SHADOW_CARD,
  TAG_LABELS, TAG_KEYS, TAG_COLORS, PHASE_COLORS,
  cyclePhaseFromDate,
} from "./theme.js";
import { useDebounce, VirtualList } from "./perf.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

const DATE_RANGES = [
  { id: "all", label: "Todo" },
  { id: "today", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

const TYPE_FILTERS = [
  { id: "all", label: "Todo" },
  { id: "note", label: "Notas" },
  { id: "exercise", label: "Ejercicios" },
];

/* ------------------------------------------------------------------
   Normalización: quita acentos, lower-case
------------------------------------------------------------------ */
function normalize(str) {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/* ------------------------------------------------------------------
   Aplanar sesiones a un formato común de "record"
   record = { id, type, date, text, tags, phase?, cycleDay? }
------------------------------------------------------------------ */
function flattenSessions({ historialEj, sesionesGym, sesionesPilates, sesionesCuello, workoutMap, lastPeriod, cycleType }) {
  const out = [];

  // Historial por ejercicio (la fuente más rica)
  if (historialEj && typeof historialEj === "object") {
    for (const exId of Object.keys(historialEj)) {
      const list = historialEj[exId] || [];
      const meta = workoutMap?.[exId] || {};
      for (let i = 0; i < list.length; i++) {
        const s = list[i] || {};
        if (!s.date) continue;
        const setsTxt = Array.isArray(s.sets)
          ? s.sets.map((set) => `${set.weight ?? "?"}kg · ${set.reps ?? "?"} reps · ${set.rir ?? ""}`).join(" | ")
          : "";
        const phaseInfo = cyclePhaseFromDate(lastPeriod, 28, cycleType || "regular");
        out.push({
          id: `ex_${exId}_${s.date}_${i}`,
          type: "exercise",
          subtype: "gym",
          date: s.date,
          text: `${meta.name || exId}${meta.day ? " · " + meta.day : ""}${setsTxt ? " — " + setsTxt : ""}`,
          tags: ["gym"],
          phase: phaseInfo?.phase || null,
        });
      }
    }
  }

  // Sesiones de gym sin detalle (registro plano)
  if (Array.isArray(sesionesGym)) {
    for (const s of sesionesGym) {
      if (!s?.date) continue;
      out.push({
        id: `gym_${s.date}`,
        type: "exercise",
        subtype: "gym",
        date: s.date,
        text: `Sesión de gym${s.day ? " · " + s.day : ""}`,
        tags: ["gym"],
      });
    }
  }

  if (Array.isArray(sesionesPilates)) {
    for (const s of sesionesPilates) {
      const date = typeof s === "string" ? s : s.date;
      if (!date) continue;
      const routine = typeof s === "string" ? null : s.routine;
      out.push({
        id: `pil_${date}_${routine || "x"}`,
        type: "exercise",
        subtype: "pilates",
        date,
        text: `Pilates${routine ? " · " + routine : ""}`,
        tags: ["pilates"],
      });
    }
  }

  if (Array.isArray(sesionesCuello)) {
    for (const d of sesionesCuello) {
      if (!d) continue;
      out.push({
        id: `cue_${d}`,
        type: "exercise",
        subtype: "cuello",
        date: d,
        text: "Movilidad cervical",
        tags: ["cuello"],
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------
   Filtro principal
------------------------------------------------------------------ */
function inDateRange(dateStr, range) {
  if (range === "all" || !dateStr) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const diffDays = Math.floor((today - d) / 86400000);
  if (range === "today") return diffDays === 0;
  if (range === "week") return diffDays >= 0 && diffDays <= 6;
  if (range === "month") return diffDays >= 0 && diffDays <= 30;
  return true;
}

function matchesQuery(record, normQuery) {
  if (!normQuery) return true;
  const haystack = [
    record.text,
    ...(record.tags || []),
    record.phase || "",
    record.subtype || "",
  ].map(normalize).join(" ");
  // Soporta búsqueda multi-palabra (AND)
  return normQuery.split(/\s+/).every((q) => q && haystack.includes(q));
}

/* ------------------------------------------------------------------
   Hook útil para reusar desde resumen / timeline
------------------------------------------------------------------ */
export function useSearchableRecords({
  notes,
  historialEj,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  workoutMap,
  lastPeriod,
  cycleType,
}) {
  return useMemo(() => {
    const noteRecords = (Array.isArray(notes) ? notes : []).map((n) => ({
      id: n.id,
      type: "note",
      date: n.date,
      text: n.text,
      tags: n.tags || ["general"],
      phase: n.phase || null,
      cycleDay: n.cycleDay || null,
      analysis: n.analysis || null,
    }));
    const sessions = flattenSessions({
      historialEj, sesionesGym, sesionesPilates, sesionesCuello,
      workoutMap, lastPeriod, cycleType,
    });
    return [...noteRecords, ...sessions].sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""));
  }, [notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello, workoutMap, lastPeriod, cycleType]);
}

/* ------------------------------------------------------------------
   UI helpers
------------------------------------------------------------------ */
function ChipRow({ items, value, onChange, multi = false, color }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => {
        const active = multi
          ? Array.isArray(value) && value.includes(it.id)
          : value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => {
              if (!multi) { onChange(it.id); return; }
              const arr = Array.isArray(value) ? value : [];
              if (arr.includes(it.id)) onChange(arr.filter((x) => x !== it.id));
              else onChange([...arr, it.id]);
            }}
            style={{
              background: active ? (color || T.accentDeep) : "transparent",
              color: active ? "#fff" : T.inkMid,
              border: `1px solid ${active ? (color || T.accentDeep) : T.line}`,
              padding: "5px 11px",
              borderRadius: 999,
              fontSize: 11, fontWeight: 600,
              letterSpacing: 0.3,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              textTransform: "uppercase",
            }}
            aria-pressed={active}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({ record }) {
  const isNote = record.type === "note";
  const accent = isNote
    ? (record.phase ? PHASE_COLORS[record.phase] : T.accentDeep)
    : T.gold;
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.line}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 12,
      padding: "10px 12px",
      margin: "0 0 8px",
      boxShadow: SHADOW_CARD,
    }}>
      <div style={{
        fontSize: 10, color: T.inkSoft, letterSpacing: 0.4,
        textTransform: "uppercase", fontWeight: 600, marginBottom: 4,
      }}>
        {record.date} · {isNote ? "Nota" : "Sesión"}{record.phase ? ` · ${record.phase}` : ""}
      </div>
      <div style={{
        fontSize: 13, color: T.ink, lineHeight: 1.4,
        display: "-webkit-box", WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {record.text}
      </div>
      {Array.isArray(record.tags) && record.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {record.tags.map((t) => (
            <span key={t} style={{
              fontSize: 9, fontWeight: 600,
              padding: "2px 6px", borderRadius: 999,
              background: `${TAG_COLORS[t] || T.inkSoft}18`,
              color: TAG_COLORS[t] || T.inkSoft,
              letterSpacing: 0.4, textTransform: "uppercase",
            }}>{TAG_LABELS[t] || t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
const MemoResultCard = React.memo(ResultCard);

/* ------------------------------------------------------------------
   Página principal: búsqueda + filtros
------------------------------------------------------------------ */
export default function NotesSearchPage({
  historialEj,
  sesionesGym,
  sesionesPilates,
  sesionesCuello,
  workoutMap,
  lastPeriod,
  cycleType,
  onBack,
}) {
  const { notes } = useVoiceNotes();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState([]);
  const [dateRange, setDateRange] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const debouncedQuery = useDebounce(query, 180);
  const normQuery = useMemo(() => normalize(debouncedQuery.trim()), [debouncedQuery]);

  const records = useSearchableRecords({
    notes, historialEj, sesionesGym, sesionesPilates, sesionesCuello,
    workoutMap, lastPeriod, cycleType,
  });

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!inDateRange(r.date, dateRange)) return false;
      if (tagFilter.length > 0 && !tagFilter.some((t) => (r.tags || []).includes(t))) return false;
      if (!matchesQuery(r, normQuery)) return false;
      return true;
    });
  }, [records, typeFilter, dateRange, tagFilter, normQuery]);

  const clearAll = useCallback(() => {
    setQuery(""); setTagFilter([]); setDateRange("all"); setTypeFilter("all");
  }, []);

  const hasFilters = query || tagFilter.length || dateRange !== "all" || typeFilter !== "all";

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
      }}>Buscar</h1>
      <p style={{ color: T.inkSoft, fontSize: 14, margin: "0 0 16px" }}>
        Encuentra notas y sesiones por tag, fecha o palabra.
      </p>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar texto, tag, fase…"
          aria-label="Buscar"
          style={{
            width: "100%",
            fontFamily: FONT_SANS, fontSize: 15, color: T.ink,
            padding: "12px 14px 12px 40px",
            border: `1px solid ${T.line}`,
            borderRadius: 12,
            background: T.cardGlass,
            outline: "none",
          }}
        />
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.inkSoft}
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M 21 21 L 16 16" />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <ChipRow items={DATE_RANGES} value={dateRange} onChange={setDateRange} color={T.accentDeep} />
        <ChipRow items={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} color={T.plumDeep} />
        <ChipRow
          items={TAG_KEYS.map((k) => ({ id: k, label: TAG_LABELS[k] }))}
          value={tagFilter}
          onChange={setTagFilter}
          multi
          color={T.gold}
        />
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 11, color: T.inkSoft, letterSpacing: 0.6,
          textTransform: "uppercase", fontWeight: 600,
        }}>
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: "transparent", border: "none",
              color: T.accentDeep, fontFamily: FONT_SANS,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 16px",
          color: T.inkSoft, fontSize: 13,
        }}>
          Sin coincidencias. Prueba con otra palabra o limpia filtros.
        </div>
      ) : filtered.length > 30 ? (
        <VirtualList
          items={filtered}
          rowHeight={108}
          height={520}
          getKey={(r) => r.id}
          renderItem={(r) => <MemoResultCard record={r} />}
        />
      ) : (
        <div>
          {filtered.map((r) => <MemoResultCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  );
}
