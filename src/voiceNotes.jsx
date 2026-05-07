// Aura — Notas por voz (Web Speech API on-device + análisis Claude opcional)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStorage } from "./storage.js";
import {
  T, FONT_SERIF, FONT_SANS, SHADOW_CARD,
  TAG_LABELS, TAG_KEYS, TAG_COLORS,
  autoTag, cyclePhaseFromDate, PHASE_COLORS,
} from "./theme.js";
import { useReducedMotion, VirtualList } from "./perf.jsx";

const STORAGE_KEY = "aura-voice-notes";

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

// Detección de soporte
export function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/* ------------------------------------------------------------------
   Hook de transcripción en vivo
------------------------------------------------------------------ */
export function useSpeechRecognition({ lang = "es-ES" } = {}) {
  const SR = getSpeechRecognition();
  const recRef = useRef(null);
  const [supported] = useState(() => Boolean(SR));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interimChunk = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) setFinalText((prev) => (prev ? prev + " " : "") + finalChunk.trim());
      setInterim(interimChunk);
    };
    rec.onerror = (e) => {
      setError(e.error || "speech-error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
      recRef.current = null;
    };
  }, [SR, lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setError(null);
    setFinalText("");
    setInterim("");
    try {
      recRef.current.start();
      setListening(true);
    } catch (e) {
      setError("start-failed");
    }
  }, []);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, interim, finalText, setFinalText, error, start, stop, reset };
}

/* ------------------------------------------------------------------
   Hook de almacenamiento de notas
------------------------------------------------------------------ */
export function useVoiceNotes() {
  const [notes, setNotes] = useStorage(STORAGE_KEY, []);
  const safe = Array.isArray(notes) ? notes : [];

  const addNote = useCallback((note) => {
    setNotes((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [{ ...note, id: note.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }, ...list];
    });
  }, [setNotes]);

  const updateNote = useCallback((id, patch) => {
    setNotes((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((n) => (n.id === id ? { ...n, ...patch } : n));
    });
  }, [setNotes]);

  const removeNote = useCallback((id) => {
    setNotes((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.filter((n) => n.id !== id);
    });
  }, [setNotes]);

  return { notes: safe, addNote, updateNote, removeNote };
}

/* ------------------------------------------------------------------
   Análisis con Claude (opcional, vía /api/claude del proyecto)
------------------------------------------------------------------ */
const ANALYSIS_SYSTEM = `Eres una coach de bienestar femenino. Analizas notas breves y devuelves un análisis empático y accionable. Responde SOLO con JSON válido (sin texto extra, sin markdown).
Esquema: { "summary": "1 frase < 100 chars", "themes": ["tema1","tema2"], "moodScore": 1-5, "energyScore": 1-5, "patterns": ["patron1"], "suggestion": "1 acción concreta < 140 chars" }`;

export async function analyzeNoteWithClaude(note, recentNotesContext = []) {
  try {
    const ctxLines = recentNotesContext
      .slice(0, 8)
      .map((n) => `- [${n.date}${n.phase ? "/" + n.phase : ""}] ${n.text.slice(0, 200)}`)
      .join("\n");
    const userPrompt = `Nota actual (${note.date}${note.phase ? `, fase ${note.phase}` : ""}):\n"""${note.text}"""\n\nContexto reciente:\n${ctxLines || "(sin notas previas)"}\n\nDevuelve sólo el JSON.`;

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: ANALYSIS_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   UI: botón micrófono — accesible, animado solo si no hay reduced-motion
------------------------------------------------------------------ */
function MicButton({ listening, disabled, onPress, reduced }) {
  const size = 84;
  return (
    <button
      type="button"
      aria-pressed={listening}
      aria-label={listening ? "Detener grabación" : "Iniciar grabación"}
      onClick={onPress}
      disabled={disabled}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        border: "none",
        background: listening
          ? `linear-gradient(135deg, ${T.warn}, ${T.accentDeep})`
          : `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
        color: "#fff",
        boxShadow: listening
          ? `0 0 0 0 ${T.warn}66, 0 12px 32px ${T.accentDeep}40`
          : `0 8px 24px ${T.accentDeep}33`,
        animation: listening && !reduced ? "auraPulse 1500ms ease-out infinite" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 200ms ease",
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------
   Página principal: Notas por voz
   Props:
     - lastPeriod, cycleType   (para vincular fase del ciclo)
     - onBack (opcional)       (para volver al menú anterior)
------------------------------------------------------------------ */
export default function VoiceNotesPage({ lastPeriod, cycleType, onBack }) {
  const reduced = useReducedMotion();
  const speech = useSpeechRecognition({ lang: "es-ES" });
  const { notes, addNote, updateNote, removeNote } = useVoiceNotes();

  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState(["general"]);
  const [analyzing, setAnalyzing] = useState(false);

  const phase = useMemo(
    () => cyclePhaseFromDate(lastPeriod, 28, cycleType || "regular"),
    [lastPeriod, cycleType]
  );

  // Sincroniza el texto transcrito al draft sin que el textarea pierda foco
  useEffect(() => {
    if (speech.finalText) setDraftText(speech.finalText);
  }, [speech.finalText]);

  // Auto-tag mientras escribe
  useEffect(() => {
    if (!draftText) { setDraftTags(["general"]); return; }
    setDraftTags(autoTag(draftText));
  }, [draftText]);

  const handleSave = useCallback(async () => {
    const text = draftText.trim();
    if (!text) return;
    const note = {
      text,
      tags: draftTags,
      date: todayStr(),
      createdAt: nowIso(),
      phase: phase?.phase || null,
      cycleDay: phase?.day || null,
      analysis: null,
    };
    addNote(note);
    setDraftText("");
    setDraftTags(["general"]);
    speech.reset();
    // Análisis Claude en background
    setAnalyzing(true);
    const recent = notes.slice(0, 8);
    const analysis = await analyzeNoteWithClaude(note, recent);
    if (analysis) updateNote(note.id || `n_${Date.now()}`, { analysis });
    setAnalyzing(false);
  }, [draftText, draftTags, phase, addNote, updateNote, notes, speech]);

  const toggleTag = useCallback((tag) => {
    setDraftTags((prev) => {
      const has = prev.includes(tag);
      if (has) return prev.filter((t) => t !== tag).length === 0 ? ["general"] : prev.filter((t) => t !== tag);
      return [...prev.filter((t) => t !== "general"), tag];
    });
  }, []);

  const liveDisplay = (draftText + (speech.interim ? " " + speech.interim : "")).trim();

  return (
    <div style={{ fontFamily: FONT_SANS, color: T.ink, paddingBottom: 16 }}>
      <style>{`
        @keyframes auraPulse {
          0% { box-shadow: 0 0 0 0 ${T.warn}55, 0 12px 32px ${T.accentDeep}40; }
          70% { box-shadow: 0 0 0 22px ${T.warn}00, 0 12px 32px ${T.accentDeep}40; }
          100% { box-shadow: 0 0 0 0 ${T.warn}00, 0 12px 32px ${T.accentDeep}40; }
        }
      `}</style>

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
      }}>Notas por voz</h1>
      <p style={{ color: T.inkSoft, fontSize: 14, margin: "0 0 20px" }}>
        Habla y se transcribe en tu dispositivo. Se guarda con tu fase del ciclo.
      </p>

      {phase && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 999,
          background: `${PHASE_COLORS[phase.phase]}1A`,
          color: PHASE_COLORS[phase.phase],
          fontSize: 12, fontWeight: 600, marginBottom: 16,
          letterSpacing: 0.4, textTransform: "uppercase",
        }}>
          Fase {phase.label} · día {phase.day}
        </div>
      )}

      {/* Panel de grabación */}
      <div style={{
        background: T.cardGlass,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${T.line}`,
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        boxShadow: SHADOW_CARD,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      }}>
        <MicButton
          listening={speech.listening}
          disabled={!speech.supported}
          reduced={reduced}
          onPress={speech.listening ? speech.stop : speech.start}
        />
        <div style={{ fontSize: 12, color: T.inkSoft, textAlign: "center", minHeight: 16 }}>
          {!speech.supported && "Tu navegador no soporta reconocimiento de voz."}
          {speech.supported && !speech.listening && "Pulsa para grabar"}
          {speech.listening && "Escuchando…"}
          {speech.error && ` · ${speech.error}`}
        </div>

        <textarea
          value={liveDisplay}
          onChange={(e) => { setDraftText(e.target.value); speech.setFinalText(e.target.value); }}
          placeholder="Escribe aquí o pulsa el micrófono…"
          rows={4}
          style={{
            width: "100%",
            fontFamily: FONT_SANS, fontSize: 15, color: T.ink,
            padding: "12px 14px",
            border: `1px solid ${T.line}`,
            borderRadius: 12,
            background: T.bg,
            resize: "vertical",
            outline: "none",
          }}
        />

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: "100%" }}>
          {TAG_KEYS.map((t) => {
            const active = draftTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                style={{
                  background: active ? TAG_COLORS[t] : "transparent",
                  color: active ? "#fff" : T.inkMid,
                  border: `1px solid ${active ? TAG_COLORS[t] : T.line}`,
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: 0.3,
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                  textTransform: "uppercase",
                }}
              >
                {TAG_LABELS[t]}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!draftText.trim()}
          style={{
            width: "100%",
            background: draftText.trim() ? `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})` : T.line,
            color: draftText.trim() ? "#fff" : T.inkSoft,
            border: "none", borderRadius: 12,
            padding: "12px 16px", fontWeight: 600,
            fontFamily: FONT_SANS, fontSize: 14, letterSpacing: 0.3,
            cursor: draftText.trim() ? "pointer" : "not-allowed",
          }}
        >
          {analyzing ? "Guardando y analizando…" : "Guardar nota"}
        </button>
      </div>

      <NotesList
        notes={notes}
        onRemove={removeNote}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   Lista de notas — usa virtualización si > 30 elementos
------------------------------------------------------------------ */

function NoteCard({ note, onRemove }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "12px 14px",
      margin: "0 0 10px",
      boxShadow: SHADOW_CARD,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: T.inkSoft, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>
          {note.date}{note.phase ? ` · ${note.phase}` : ""}
        </div>
        <button
          type="button"
          aria-label="Eliminar nota"
          onClick={() => onRemove(note.id)}
          style={{ background: "transparent", border: "none", color: T.inkSoft, cursor: "pointer", fontSize: 14 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
        {note.text}
      </div>
      {Array.isArray(note.tags) && note.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {note.tags.map((t) => (
            <span key={t} style={{
              fontSize: 10, fontWeight: 600,
              padding: "2px 7px", borderRadius: 999,
              background: `${TAG_COLORS[t] || T.inkSoft}18`,
              color: TAG_COLORS[t] || T.inkSoft,
              letterSpacing: 0.4, textTransform: "uppercase",
            }}>{TAG_LABELS[t] || t}</span>
          ))}
        </div>
      )}
      {note.analysis && (
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: `${T.gold}10`, border: `1px solid ${T.gold}33`,
          borderRadius: 10, fontSize: 12, color: T.inkMid,
        }}>
          <div style={{ fontWeight: 600, color: T.accentDeep, marginBottom: 2 }}>
            Aura · {note.analysis.summary}
          </div>
          {note.analysis.suggestion && (
            <div style={{ fontStyle: "italic" }}>→ {note.analysis.suggestion}</div>
          )}
        </div>
      )}
    </div>
  );
}

const MemoNoteCard = React.memo(NoteCard);

function NotesList({ notes, onRemove }) {
  if (!notes.length) {
    return (
      <div style={{
        textAlign: "center", padding: "32px 16px",
        color: T.inkSoft, fontSize: 13,
      }}>
        Aún no hay notas. Empieza grabando tu primera reflexión.
      </div>
    );
  }

  // Para listas largas usamos VirtualList con altura aproximada por nota
  if (notes.length > 30) {
    return (
      <VirtualList
        items={notes}
        rowHeight={140}
        height={520}
        getKey={(n) => n.id}
        renderItem={(n) => <MemoNoteCard note={n} onRemove={onRemove} />}
      />
    );
  }

  return (
    <div>
      {notes.map((n) => (
        <MemoNoteCard key={n.id} note={n} onRemove={onRemove} />
      ))}
    </div>
  );
}
