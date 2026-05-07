import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { todayStr, weekKey, monthKey, DAY_OF_WEEK, isNightTime } from "./src/lib/dates.js";
import { getContextualGreeting, getDayMessage } from "./src/lib/messages.js";
import { mixColors } from "./src/lib/colors.js";
import { toRoman } from "./src/lib/roman.js";
import { DAILY_MANTRAS, getMantraOfDay, getSeasonalMantra } from "./src/lib/mantras.js";
import { NARRATIVE_SEASONS, SEASON_CYCLE_LENGTH, calcNarrativeSeason } from "./src/lib/season.js";
import { CYCLE_PHASES, calcCyclePhase } from "./src/lib/cycle.js";
import { suggestWeight } from "./src/lib/training.js";
import { detectFertileWindow, detectPatterns } from "./src/lib/cycle-insights.js";
import { useStorage } from "./src/hooks/useStorage.js";
import { useAchievements } from "./src/hooks/useAchievements.js";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS } from "./src/lib/achievements.js";

/* ============================================================
   AURA — Bienestar con contexto total
   ============================================================ */

const T_DAY = {
  bg: "#FDF6F1",
  bgAlt: "#F7E8DD",
  bgSoft: "#FBF1E9",
  card: "#FFFFFF",
  cardGlass: "rgba(255, 255, 255, 0.65)",
  ink: "#3A2B26",
  inkMid: "#7A6A63",
  inkSoft: "#9A8A82",
  line: "#EADDD2",
  lineSoft: "#F5EADC",
  accent: "#D4A59A",
  accentDeep: "#B8806F",
  gold: "#C9A96E",
  success: "#8BA888",
  warn: "#C27E6C",
};

const T_NIGHT = {
  bg: "#1A1525",
  bgAlt: "#241B30",
  bgSoft: "#1F1A2D",
  card: "rgba(45, 35, 60, 0.6)",
  cardGlass: "rgba(45, 35, 60, 0.5)",
  ink: "#F5EADC",
  inkMid: "#C9B8A8",
  inkSoft: "#8A7A8E",
  line: "rgba(201, 169, 110, 0.2)",
  lineSoft: "rgba(201, 169, 110, 0.1)",
  accent: "#E8C99C",
  accentDeep: "#D4A59A",
  gold: "#E8C99C",
  success: "#A8C4A0",
  warn: "#E8A094",
};

// La paleta T se resuelve dinámicamente según hora
const T = isNightTime() ? T_NIGHT : T_DAY;

const GRADIENTS = isNightTime() ? {
  aurora: "linear-gradient(135deg, #3A2545 0%, #4A3055 30%, #2D2040 60%, #1F1A2D 100%)",
  earth: "linear-gradient(135deg, #3A2B35 0%, #2D2040 50%, #1F1A2D 100%)",
  lunar: "linear-gradient(135deg, #241B30 0%, #2D2040 50%, #3A2545 100%)",
  gold: "linear-gradient(135deg, #C9A96E 0%, #E8C99C 50%, #C9A96E 100%)",
} : {
  aurora: "linear-gradient(135deg, #FFE0D6 0%, #F9D5C8 30%, #E8C5D0 60%, #D8C0D8 100%)",
  earth: "linear-gradient(135deg, #F5E0CE 0%, #E8D0B8 50%, #D4A59A 100%)",
  lunar: "linear-gradient(135deg, #FDF6F1 0%, #F0D5D0 50%, #D8C0D8 100%)",
  gold: "linear-gradient(135deg, #C9A96E 0%, #E8C99C 50%, #C9A96E 100%)",
};

const getAtmosphere = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 9) return { gradient: "linear-gradient(180deg, #FFE8DC 0%, #FDF6F1 40%, #FBF1E9 100%)", glow: "#FFD4B8" };
  if (h >= 9 && h < 17) return { gradient: "linear-gradient(180deg, #FDF6F1 0%, #FBF1E9 50%, #F9ECE0 100%)", glow: "#F5E0CE" };
  if (h >= 17 && h < 20) return { gradient: "linear-gradient(180deg, #F9E4D9 0%, #F0D5D0 50%, #E8C8D4 100%)", glow: "#E8B8C4" };
  // NOCHE — violeta profundo con gradiente atmosférico
  return {
    gradient: "linear-gradient(180deg, #1A1525 0%, #241B30 40%, #1F1A2D 100%)",
    glow: "#4A3060"
  };
};

const FONT_SERIF = `'Playfair Display', Georgia, serif`;
const FONT_SANS = `'DM Sans', system-ui, sans-serif`;

const SHADOW_CARD = "0 1px 2px rgba(58,43,38,0.04), 0 4px 16px rgba(180,130,110,0.06), 0 16px 48px rgba(180,130,110,0.04)";
const SHADOW_ELEV = "0 2px 4px rgba(58,43,38,0.06), 0 8px 24px rgba(180,130,110,0.08), 0 24px 64px rgba(180,130,110,0.10)";
const SHADOW_HERO = "0 4px 12px rgba(58,43,38,0.04), 0 20px 60px rgba(180,130,110,0.12), 0 40px 100px rgba(180,130,110,0.08)";

const TX_FAST = "180ms cubic-bezier(0.4, 0, 0.2, 1)";
const TX_SMOOTH = "400ms cubic-bezier(0.4, 0, 0.2, 1)";
const TX_BOUNCY = "500ms cubic-bezier(0.34, 1.56, 0.64, 1)";

/* ============================================================
   TEMPORADAS NARRATIVAS — Capítulos de la journey en Aura
   ============================================================
   No se confunden con fases del ciclo menstrual: son capítulos
   LARGOS basados en días de uso. Ciclo total: 120 días, después
   reinicia (nueva Raíz). La usuaria atraviesa Raíz → Bloom →
   Quietud y vuelve, en espiral, cada vez más profundo.
   Definiciones movidas a src/lib/season.js y src/lib/mantras.js
*/

/* ============================================================
   ORNAMENTOS TIPOGRÁFICOS — separadores editoriales
   ============================================================ */
const ORNAMENTS = {
  fleuron: "❦",      // clásico, cálido (default)
  star: "✦",         // brillante, aspiracional
  diamond: "❈",      // geométrico, firme
  rhombus: "❖",      // estructural
  asterism: "⁂",     // literario, introspectivo
  leaf: "❧",         // orgánico
};

function Ornament({
  variant = "fleuron",
  size = 14,
  spacing = 28,
  withLines = true,
  color,
  style = {},
}) {
  const glyph = ORNAMENTS[variant] || ORNAMENTS.fleuron;
  const lineColor = color || T.line;
  const glyphColor = color || T.gold;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        margin: `${spacing}px 0`,
        ...style,
      }}
      aria-hidden="true"
    >
      {withLines && (
        <div
          style={{
            flex: 1,
            maxWidth: 80,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${lineColor})`,
          }}
        />
      )}
      <span
        style={{
          fontFamily: FONT_SERIF,
          fontSize: size,
          color: glyphColor,
          letterSpacing: "0.3em",
          fontFeatureSettings: '"liga" 1, "dlig" 1',
          opacity: 0.85,
        }}
      >
        {glyph}
      </span>
      {withLines && (
        <div
          style={{
            flex: 1,
            maxWidth: 80,
            height: 1,
            background: `linear-gradient(90deg, ${lineColor}, transparent)`,
          }}
        />
      )}
    </div>
  );
}

/* Variante trío: tres glifos espaciados (estilo libro antiguo) */
function OrnamentTrio({ variant = "star", size = 10, spacing = 32, color }) {
  const glyph = ORNAMENTS[variant] || ORNAMENTS.star;
  const glyphColor = color || T.gold;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        margin: `${spacing}px 0`,
      }}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            fontFamily: FONT_SERIF,
            fontSize: size,
            color: glyphColor,
            opacity: i === 1 ? 0.9 : 0.5,
          }}
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   TIPOGRAFÍA EDITORIAL — OpenType pro components
   ============================================================ */

/* Drop cap con control React (más flexible que ::first-letter) */
function DropCap({
  letter,
  variant = "default", // "default" | "gold" | "outline"
  size = 72,
  style = {},
}) {
  const isGold = variant === "gold";
  const isOutline = variant === "outline";

  return (
    <span
      style={{
        float: "left",
        fontFamily: FONT_SERIF,
        fontSize: size,
        fontWeight: isOutline ? 400 : 500,
        fontStyle: variant === "default" ? "italic" : "normal",
        lineHeight: 0.82,
        paddingRight: 12,
        paddingTop: 6,
        marginBottom: -4,
        color: isGold ? "transparent" : T.accentDeep,
        WebkitTextStroke: isOutline ? `1.5px ${T.accentDeep}` : "none",
        background: isGold
          ? `linear-gradient(135deg, ${T.gold} 0%, ${T.accentDeep} 100%)`
          : "none",
        WebkitBackgroundClip: isGold ? "text" : "initial",
        backgroundClip: isGold ? "text" : "initial",
        fontFeatureSettings: '"swsh" 1, "cswh" 1, "salt" 1, "ss01" 1',
        ...style,
      }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

/* Pull quote editorial con comillas gigantes */
function PullQuote({ children, attribution, style = {} }) {
  return (
    <blockquote
      style={{
        position: "relative",
        padding: "32px 24px 28px 56px",
        margin: "32px 0",
        fontFamily: FONT_SERIF,
        fontSize: 22,
        fontStyle: "italic",
        lineHeight: 1.45,
        color: T.ink,
        borderLeft: `2px solid ${T.gold}`,
        fontFeatureSettings: '"liga" 1, "dlig" 1, "swsh" 1',
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 8,
          top: -4,
          fontFamily: FONT_SERIF,
          fontSize: 88,
          lineHeight: 1,
          color: T.gold,
          opacity: 0.45,
          fontStyle: "italic",
          pointerEvents: "none",
          userSelect: "none",
        }}
        aria-hidden="true"
      >
        "
      </span>
      <div>{children}</div>
      {attribution && (
        <footer
          style={{
            marginTop: 14,
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontStyle: "normal",
            fontVariantCaps: "all-small-caps",
            letterSpacing: "0.12em",
            color: T.inkMid,
          }}
        >
          — {attribution}
        </footer>
      )}
    </blockquote>
  );
}

/* Smallcaps verdaderas (no text-transform) */
function SmallCaps({ children, tracking = 0.12, weight = 500, style = {} }) {
  return (
    <span
      style={{
        fontVariantCaps: "all-small-caps",
        fontFeatureSettings: '"smcp" 1, "c2sc" 1',
        letterSpacing: `${tracking}em`,
        fontWeight: weight,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* Título editorial con todas las features OpenType activas */
function EditorialTitle({
  children,
  level = 1,
  italic = false,
  style = {},
}) {
  const sizes = { 1: 42, 2: 32, 3: 26, 4: 20 };
  const Tag = `h${Math.min(level, 6)}`;
  return (
    <Tag
      style={{
        fontFamily: FONT_SERIF,
        fontSize: sizes[level] || 20,
        fontWeight: 400,
        fontStyle: italic ? "italic" : "normal",
        lineHeight: 1.15,
        letterSpacing: level <= 2 ? "-0.01em" : 0,
        color: T.ink,
        margin: 0,
        fontFeatureSettings:
          '"liga" 1, "dlig" 1, "calt" 1, "swsh" 1, "cswh" 1, "hist" 1, "ss01" 1, "kern" 1',
        fontVariantLigatures:
          "common-ligatures discretionary-ligatures historical-ligatures contextual",
        textRendering: "geometricPrecision",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* Párrafo editorial — prosa larga con números old-style y hyphenation */
function EditorialProse({ children, dropCap = false, style = {} }) {
  return (
    <p
      style={{
        fontFamily: FONT_SERIF,
        fontSize: 17,
        lineHeight: 1.65,
        color: T.ink,
        fontFeatureSettings: '"liga" 1, "calt" 1, "kern" 1, "onum" 1',
        fontVariantNumeric: "oldstyle-nums proportional-nums",
        hyphens: "auto",
        WebkitHyphens: "auto",
        hangingPunctuation: "first last",
        textAlign: "justify",
        margin: "0 0 16px 0",
        ...style,
      }}
    >
      {dropCap && typeof children === "string" && children.length > 0 && (
        <DropCap
          letter={children[0]}
          variant={dropCap === true ? "default" : dropCap}
        />
      )}
      {dropCap && typeof children === "string"
        ? children.slice(1)
        : children}
    </p>
  );
}

/* ============================================================
   ACHIEVEMENTS — Medallas narrativas (capilla, no videojuego)
   ============================================================ */

/*
  Cada logro tiene:
  - id:          key estable para storage
  - category:    "constancia" | "hitos" | "descubrimientos" | "ritos"
  - name:        nombre corto (serif italic)
  - narrative:   frase que aparece al desbloquear (1-2 líneas)
  - glyph:       nombre del glifo SVG (ver AchievementGlyph)
  - check:       función (ctx) => boolean
*/
/* ─── SVG GLYPHS (dibujados a mano, sin emojis) ─── */
function AchievementGlyph({ name, size = 48, color, locked = false }) {
  const stroke = locked ? "#9A8A82" : color;
  const fillOpacity = locked ? 0.15 : 0.85;
  const sw = 1.5; // stroke-width

  const paths = {
    // Llama: gota vertical con ondulación
    flame: (
      <>
        <path d="M24 8 C18 18, 14 24, 14 32 C14 40, 18 44, 24 44 C30 44, 34 40, 34 32 C34 24, 30 18, 24 8 Z"
          fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M24 20 C21 24, 20 28, 21 32 C22 35, 24 36, 26 34"
          fill="none" stroke={locked ? "#7A6A63" : "#FFF"} strokeWidth={1} strokeLinecap="round" opacity={locked ? 0.3 : 0.5} />
      </>
    ),
    // Raíz: tres líneas orgánicas hacia abajo desde círculo
    root: (
      <>
        <circle cx="24" cy="14" r="6" fill="none" stroke={stroke} strokeWidth={sw} />
        <path d="M24 20 L24 36 M24 28 C20 30, 18 34, 16 40 M24 28 C28 30, 30 34, 32 40"
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </>
    ),
    // Nueve lunas: fase lunar en arco
    moons: (
      <>
        <circle cx="10" cy="24" r="3" fill="none" stroke={stroke} strokeWidth={sw} opacity={0.4} />
        <circle cx="18" cy="16" r="3.5" fill="none" stroke={stroke} strokeWidth={sw} opacity={0.6} />
        <circle cx="24" cy="12" r="4" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} />
        <circle cx="30" cy="16" r="3.5" fill="none" stroke={stroke} strokeWidth={sw} opacity={0.6} />
        <circle cx="38" cy="24" r="3" fill="none" stroke={stroke} strokeWidth={sw} opacity={0.4} />
      </>
    ),
    // Vasija: silueta de ánfora
    vessel: (
      <>
        <path d="M18 10 L18 14 C14 16, 12 22, 12 28 C12 36, 16 42, 24 42 C32 42, 36 36, 36 28 C36 22, 34 16, 30 14 L30 10 Z"
          fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <line x1="16" y1="10" x2="32" y2="10" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </>
    ),
    // Espiral: crecimiento en vueltas
    spiral: (
      <path d="M24 24 m-2,0 a2,2 0 1,1 4,0 a4,4 0 1,1 -8,0 a6,6 0 1,1 12,0 a8,8 0 1,1 -16,0 a10,10 0 1,1 20,0"
        fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    ),
    // Infinito: lazo horizontal
    infinity: (
      <path d="M12 24 C12 19, 16 16, 20 20 C22 22, 24 24, 24 24 C24 24, 26 26, 28 28 C32 32, 36 29, 36 24 C36 19, 32 16, 28 20 C26 22, 24 24, 24 24 C24 24, 22 22, 20 20 C16 16, 12 19, 12 24 Z"
        fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    ),
    // Carta: sobre con sello
    letter: (
      <>
        <rect x="10" y="14" width="28" height="20" rx="2" fill={stroke} fillOpacity={fillOpacity * 0.4} stroke={stroke} strokeWidth={sw} />
        <path d="M10 14 L24 26 L38 14" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <circle cx="24" cy="30" r="2" fill={stroke} opacity={locked ? 0.3 : 0.7} />
      </>
    ),
    // Oreja: curva en espiral
    ear: (
      <>
        <path d="M30 14 C22 14, 16 20, 16 28 C16 34, 20 38, 24 38 C26 38, 28 36, 28 34"
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M28 20 C24 20, 22 24, 22 28 C22 30, 23 31, 25 31"
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" opacity={0.7} />
      </>
    ),
    // Mapa: pliegues y punto
    map: (
      <>
        <path d="M10 14 L18 12 L30 16 L38 14 L38 36 L30 38 L18 34 L10 36 Z"
          fill={stroke} fillOpacity={fillOpacity * 0.3} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <line x1="18" y1="12" x2="18" y2="34" stroke={stroke} strokeWidth={sw * 0.7} opacity={0.5} />
        <line x1="30" y1="16" x2="30" y2="38" stroke={stroke} strokeWidth={sw * 0.7} opacity={0.5} />
        <circle cx="24" cy="24" r="1.8" fill={stroke} />
      </>
    ),
    // Gota: lágrima
    drop: (
      <path d="M24 8 C18 18, 12 26, 12 32 C12 39, 17 44, 24 44 C31 44, 36 39, 36 32 C36 26, 30 18, 24 8 Z"
        fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    ),
    // Flor: cuatro pétalos
    flower: (
      <>
        <circle cx="24" cy="24" r="3" fill={stroke} />
        <path d="M24 10 C28 14, 28 20, 24 24 C20 20, 20 14, 24 10 Z" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M38 24 C34 28, 28 28, 24 24 C28 20, 34 20, 38 24 Z" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M24 38 C20 34, 20 28, 24 24 C28 28, 28 34, 24 38 Z" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M10 24 C14 20, 20 20, 24 24 C20 28, 14 28, 10 24 Z" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </>
    ),
    // Luna creciente
    crescent: (
      <path d="M32 10 C24 10, 16 17, 16 26 C16 35, 24 42, 32 42 C27 40, 22 34, 22 26 C22 18, 27 12, 32 10 Z"
        fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Círculo de fondo sutil */}
      <circle
        cx="24" cy="24" r="23"
        fill="none"
        stroke={stroke}
        strokeWidth={0.8}
        opacity={locked ? 0.2 : 0.35}
        strokeDasharray={locked ? "2 3" : "none"}
      />
      {paths[name] || paths.flame}
    </svg>
  );
}

/* ─── Hook: detecta logros desbloqueados ─── */
/* ─── Reveal fullscreen narrativo ─── */
function AchievementReveal({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [medalStage, setMedalStage] = useState(0); // 0 = hidden, 1 = entrada spring

  useEffect(() => {
    if (achievement) {
      const t1 = setTimeout(() => setVisible(true), 50);
      const t2 = setTimeout(() => setMedalStage(1), 400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    setVisible(false);
    setMedalStage(0);
  }, [achievement]);

  // Spring para la medalla: escala de 0.3 → 1 con overshoot físico
  const medalScale = useSpring(medalStage === 1 ? 1 : 0.3, { stiffness: 140, damping: 11, mass: 1 });
  const medalOpacity = useSpring(medalStage === 1 ? 1 : 0, "stiff");

  if (!achievement) return null;

  const cat = ACHIEVEMENT_CATEGORIES[achievement.category];
  const accentColor = T[cat?.color] || T.gold;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: isNightTime()
          ? "radial-gradient(ellipse at center, rgba(45,35,60,0.92) 0%, rgba(26,21,37,0.98) 100%)"
          : "radial-gradient(ellipse at center, rgba(253,246,241,0.96) 0%, rgba(247,232,221,0.98) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        opacity: visible ? 1 : 0,
        transition: `opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)`,
        cursor: "pointer",
      }}
      role="dialog"
      aria-label={`Logro desbloqueado: ${achievement.name}`}
    >
      {/* Glow radial detrás de la medalla */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
          opacity: visible ? 1 : 0,
          transition: "opacity 1400ms ease",
          pointerEvents: "none",
          animation: visible ? "breathe 4s ease-in-out infinite" : "none",
        }}
      />

      {/* Ornamento superior */}
      <div
        style={{
          opacity: visible ? 0.7 : 0,
          transform: visible ? "translateY(0)" : "translateY(-12px)",
          transition: "all 900ms cubic-bezier(0.4, 0, 0.2, 1) 200ms",
          fontFamily: FONT_SERIF,
          fontSize: 18,
          color: accentColor,
          letterSpacing: "0.5em",
          marginBottom: 48,
        }}
      >
        ❦
      </div>

      {/* Medalla — spring-physics real */}
      <div
        style={{
          position: "relative",
          opacity: medalOpacity,
          transform: `scale(${medalScale})`,
          willChange: "transform, opacity",
          marginBottom: 40,
        }}
      >
        <AchievementGlyph name={achievement.glyph} size={140} color={accentColor} />
      </div>

      {/* Categoría en smallcaps */}
      <div
        style={{
          opacity: visible ? 0.65 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "all 800ms cubic-bezier(0.4, 0, 0.2, 1) 900ms",
          fontFamily: FONT_SANS,
          fontSize: 11,
          fontVariantCaps: "all-small-caps",
          fontFeatureSettings: '"smcp" 1, "c2sc" 1',
          letterSpacing: "0.25em",
          color: T.inkMid,
          marginBottom: 14,
        }}
      >
        {cat?.label || "Logro"} · Desbloqueado
      </div>

      {/* Nombre */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "all 900ms cubic-bezier(0.4, 0, 0.2, 1) 1100ms",
          fontFamily: FONT_SERIF,
          fontSize: 38,
          fontStyle: "italic",
          fontWeight: 400,
          color: T.ink,
          textAlign: "center",
          marginBottom: 20,
          letterSpacing: "-0.01em",
          fontFeatureSettings: '"liga" 1, "dlig" 1, "swsh" 1',
        }}
      >
        {achievement.name}
      </div>

      {/* Narrativa */}
      <div
        style={{
          opacity: visible ? 0.85 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "all 900ms cubic-bezier(0.4, 0, 0.2, 1) 1400ms",
          fontFamily: FONT_SERIF,
          fontSize: 17,
          lineHeight: 1.6,
          color: T.inkMid,
          textAlign: "center",
          maxWidth: 380,
          whiteSpace: "pre-line",
          fontStyle: "italic",
          marginBottom: 56,
        }}
      >
        {achievement.narrative}
      </div>

      {/* Ornamento inferior + hint */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          opacity: visible ? 0.5 : 0,
          transition: "opacity 1000ms ease 1800ms",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 14,
            color: accentColor,
            letterSpacing: "0.4em",
            marginBottom: 10,
          }}
          aria-hidden="true"
        >
          ✦ ✦ ✦
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 10,
            color: T.inkSoft,
            letterSpacing: "0.2em",
            fontVariantCaps: "all-small-caps",
          }}
        >
          Tocá para continuar
        </div>
      </div>
    </div>
  );
}

/* ─── Galería completa de logros ─── */
function AchievementsGallery({ unlocked, onBack }) {
  const grouped = {};
  ACHIEVEMENTS.forEach((ach) => {
    if (!grouped[ach.category]) grouped[ach.category] = [];
    grouped[ach.category].push(ach);
  });

  const totalUnlocked = Object.keys(unlocked || {}).length;

  return (
    <div style={{ padding: "32px 24px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 11,
            fontVariantCaps: "all-small-caps",
            fontFeatureSettings: '"smcp" 1',
            letterSpacing: "0.25em",
            color: T.inkMid,
            marginBottom: 8,
          }}
        >
          Tu colección
        </div>
        <h1
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 36,
            fontStyle: "italic",
            fontWeight: 400,
            color: T.ink,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Rituales
        </h1>
        <div
          style={{
            marginTop: 6,
            fontFamily: FONT_SERIF,
            fontSize: 13,
            color: T.inkSoft,
            fontStyle: "italic",
          }}
        >
          {totalUnlocked} de {ACHIEVEMENTS.length} desbloqueados
        </div>
      </div>

      {Object.entries(grouped).map(([catKey, items]) => {
        const cat = ACHIEVEMENT_CATEGORIES[catKey];
        const accent = T[cat?.color] || T.gold;
        return (
          <div key={catKey} style={{ marginBottom: 40 }}>
            <Ornament variant="fleuron" spacing={20} color={accent} />
            <div
              style={{
                textAlign: "center",
                fontFamily: FONT_SANS,
                fontSize: 11,
                fontVariantCaps: "all-small-caps",
                fontFeatureSettings: '"smcp" 1',
                letterSpacing: "0.3em",
                color: T.inkMid,
                marginBottom: 20,
              }}
            >
              {cat?.label}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              {items.map((ach) => {
                const isUnlocked = !!unlocked?.[ach.id];
                return (
                  <div
                    key={ach.id}
                    style={{
                      textAlign: "center",
                      opacity: isUnlocked ? 1 : 0.55,
                      transition: "opacity 300ms ease",
                    }}
                  >
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
                      <AchievementGlyph
                        name={ach.glyph}
                        size={64}
                        color={accent}
                        locked={!isUnlocked}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: FONT_SERIF,
                        fontSize: 13,
                        fontStyle: "italic",
                        color: isUnlocked ? T.ink : T.inkSoft,
                        lineHeight: 1.3,
                      }}
                    >
                      {isUnlocked ? ach.name : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {onBack && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: `1px solid ${T.line}`,
              color: T.inkMid,
              fontFamily: FONT_SANS,
              fontSize: 12,
              letterSpacing: "0.15em",
              fontVariantCaps: "all-small-caps",
              padding: "12px 28px",
              borderRadius: 24,
              cursor: "pointer",
            }}
          >
            volver
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SPRING PHYSICS — Animaciones físicas realistas
   ============================================================
   Sin libs externas. Implementa un spring damped clásico:
      a = -k(x - target) / m - c * v
   donde k=stiffness, c=damping, m=mass. Integrado con rAF.
*/

const SPRING_PRESETS = {
  gentle:   { stiffness: 120, damping: 14, mass: 1 },   // suave, pocas oscilaciones
  wobbly:   { stiffness: 180, damping: 12, mass: 1 },   // juguetón, rebote visible
  stiff:    { stiffness: 260, damping: 20, mass: 1 },   // rápido, controlado
  slow:     { stiffness: 60,  damping: 15, mass: 1 },   // ceremonial
  molasses: { stiffness: 40,  damping: 18, mass: 1.2 }, // muy lento (reveals)
};

function useSpring(target, config = "gentle") {
  const preset = typeof config === "string" ? SPRING_PRESETS[config] : config;
  const { stiffness = 120, damping = 14, mass = 1, precision = 0.01 } = preset || SPRING_PRESETS.gentle;

  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const velocityRef = useRef(0);
  const rafRef = useRef(null);
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    if (rafRef.current) return; // ya está corriendo

    let lastTime = performance.now();

    const step = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.064); // clamp a 16*4ms
      lastTime = now;

      const x = valueRef.current;
      const v = velocityRef.current;
      const t = targetRef.current;

      // Fuerza del resorte + amortiguamiento
      const springForce = -stiffness * (x - t);
      const dampingForce = -damping * v;
      const acceleration = (springForce + dampingForce) / mass;

      const newV = v + acceleration * dt;
      const newX = x + newV * dt;

      velocityRef.current = newV;
      valueRef.current = newX;

      // Condición de parada: cerca del target y con velocidad baja
      if (Math.abs(newV) < precision && Math.abs(newX - t) < precision) {
        valueRef.current = t;
        velocityRef.current = 0;
        setValue(t);
        rafRef.current = null;
        return;
      }

      setValue(newX);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, stiffness, damping, mass, precision]);

  return value;
}

/* Botón con feedback táctil spring-physics
   Al presionar: scale 1 → 0.92, al soltar: spring de vuelta a 1 con overshoot */
function SpringButton({
  children,
  onClick,
  disabled = false,
  preset = "wobbly",
  style = {},
  haptic = true,
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSpring(pressed ? 0.92 : 1, preset);

  const trigger = (e) => {
    if (disabled) return;
    if (haptic && typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(8); } catch {}
    }
    onClick?.(e);
  };

  return (
    <button
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={trigger}
      disabled={disabled}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center",
        willChange: "transform",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* Wrapper que anima la aparición de su contenido con spring
   Útil para cards que aparecen al entrar a una página */
function SpringScale({
  show = true,
  delay = 0,
  from = 0.85,
  to = 1,
  preset = "gentle",
  children,
  style = {},
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setActive(true), delay);
      return () => clearTimeout(t);
    }
    setActive(false);
  }, [show, delay]);

  const scale = useSpring(active ? to : from, preset);
  const opacity = useSpring(active ? 1 : 0, "stiff");

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* Valor numérico que se anima con spring al cambiar
   Útil para contadores, streaks, porcentajes */
function SpringNumber({ value, preset = "gentle", format = (v) => Math.round(v), style = {} }) {
  const animated = useSpring(value, preset);
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(animated)}</span>;
}

/* ============================================================
   PARALLAX CURSOR — Hover states premium (solo desktop)
   ============================================================
   Detecta si el dispositivo tiene hover real (mouse) antes de activar.
   En mobile/touch: los componentes degradan a estado estático.
*/

/* Detecta si el device soporta hover real (mouse, no touch) */
function useHasHover() {
  const [hasHover, setHasHover] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHasHover(mq.matches);
    const handler = (e) => setHasHover(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);
  return hasHover;
}

/* Hook principal: devuelve posición normalizada del cursor dentro del elemento
   Retorna { x: -1 a 1, y: -1 a 1, active: boolean } con easing suave */
function useParallax(ref, { intensity = 1, smoothing = 0.12 } = {}) {
  const hasHover = useHasHover();
  const [coords, setCoords] = useState({ x: 0, y: 0, active: false });
  const targetRef = useRef({ x: 0, y: 0, active: false });
  const rafRef = useRef(null);

  useEffect(() => {
    if (!hasHover || !ref.current) return;
    const el = ref.current;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = ((e.clientX - cx) / (rect.width / 2)) * intensity;
      const ny = ((e.clientY - cy) / (rect.height / 2)) * intensity;
      targetRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
        active: true,
      };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0, active: false };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    };

    const tick = () => {
      setCoords((prev) => {
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        const active = targetRef.current.active;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && prev.active === active) {
          rafRef.current = null;
          return prev;
        }
        rafRef.current = requestAnimationFrame(tick);
        return {
          x: prev.x + dx * smoothing,
          y: prev.y + dy * smoothing,
          active,
        };
      });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [hasHover, intensity, smoothing, ref]);

  return coords;
}

/* Card con tilt 3D al hover (rotateX/rotateY) */
function TiltCard({
  children,
  intensity = 0.5,      // 0 = sin tilt, 1 = intenso
  maxRotation = 6,      // grados
  scale = 1.02,         // escala en hover
  perspective = 1000,
  glow = false,         // añade glow sutil
  style = {},
  ...rest
}) {
  const ref = useRef(null);
  const { x, y, active } = useParallax(ref, { intensity, smoothing: 0.15 });

  const rotateY = x * maxRotation;
  const rotateX = -y * maxRotation;
  const currentScale = active ? scale : 1;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${currentScale})`,
        transformStyle: "preserve-3d",
        transition: active ? "none" : "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "transform",
        ...style,
      }}
      {...rest}
    >
      {glow && active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `radial-gradient(circle at ${50 + x * 30}% ${50 + y * 30}%, ${T.gold}22 0%, transparent 60%)`,
            pointerEvents: "none",
            transition: "opacity 300ms ease",
          }}
        />
      )}
      {children}
    </div>
  );
}

/* Magnetic hover: contenido se desplaza sutilmente hacia el cursor */
function MagneticHover({
  children,
  strength = 12,   // px máximos de desplazamiento
  style = {},
  ...rest
}) {
  const ref = useRef(null);
  const { x, y, active } = useParallax(ref, { intensity: 1, smoothing: 0.2 });

  return (
    <div
      ref={ref}
      style={{
        display: "inline-block",
        transform: `translate(${x * strength}px, ${y * strength}px)`,
        transition: active ? "none" : "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        willChange: "transform",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* Glow spotlight que sigue el cursor dentro de una card */
function CursorGlow({
  children,
  color,
  size = 300,
  opacity = 0.25,
  radius = 16,
  style = {},
  ...rest
}) {
  const ref = useRef(null);
  const hasHover = useHasHover();
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    if (!hasHover || !ref.current) return;
    const el = ref.current;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      setPos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
        active: true,
      });
    };
    const onLeave = () => setPos((p) => ({ ...p, active: false }));
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [hasHover]);

  const glowColor = color || T.gold;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        ...style,
      }}
      {...rest}
    >
      {hasHover && (
        <div
          style={{
            position: "absolute",
            left: `calc(${pos.x * 100}% - ${size / 2}px)`,
            top: `calc(${pos.y * 100}% - ${size / 2}px)`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            opacity: pos.active ? opacity : 0,
            transition: "opacity 400ms ease",
            pointerEvents: "none",
            filter: "blur(20px)",
            mixBlendMode: "soft-light",
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

/* ============================================================
   EDITORIAL GRIDS — Layouts asimétricos tipo revista
   ============================================================
   Composiciones que rompen la simetría de cards apiladas.
   Pensadas para mobile-first (viewport angosto) con degradación
   elegante: en <480px muchas se vuelven single-column.
*/

/*
  EditorialGrid — contenedor con variantes predefinidas

  Variantes:
    "bento"      → grid 2x2 con tamaños variados (hero + 3 pequeñas)
    "magazine"   → hero grande arriba, sidebar estrecho abajo
    "manuscript" → columna central con márgenes negativos ocasionales
    "broken"     → grid regular, pero items con className="break-left"/"break-right" se desplazan
    "stacked"    → apilado vertical con offsets horizontales alternados

  Children esperados: usa data-span="2x1" | "1x2" | "2x2" | "1x1" (default)
*/
function EditorialGrid({
  variant = "bento",
  gap = 16,
  children,
  style = {},
  ...rest
}) {
  const childArr = React.Children.toArray(children);

  if (variant === "bento") {
    // Grid 2 columnas donde los hijos pueden ocupar distintas celdas
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridAutoRows: "minmax(100px, auto)",
          gap,
          ...style,
        }}
        {...rest}
      >
        {childArr.map((child, i) => {
          const span = child?.props?.["data-span"] || "1x1";
          const [cols, rows] = span.split("x").map(Number);
          return (
            <div
              key={i}
              style={{
                gridColumn: `span ${cols}`,
                gridRow: `span ${rows}`,
                minWidth: 0,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "magazine") {
    // Hero arriba (ancho completo), luego 2/3 + 1/3 abajo
    const [hero, ...rest2] = childArr;
    const mainContent = rest2.slice(0, Math.ceil(rest2.length / 2));
    const sidebar = rest2.slice(Math.ceil(rest2.length / 2));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap, ...style }} {...rest}>
        {hero && <div>{hero}</div>}
        {rest2.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap }}>
            <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
              {mainContent}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
              {sidebar}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "manuscript") {
    // Columna central angosta, items con data-pull="left|right|full" rompen márgenes
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          maxWidth: 560,
          margin: "0 auto",
          position: "relative",
          ...style,
        }}
        {...rest}
      >
        {childArr.map((child, i) => {
          const pull = child?.props?.["data-pull"];
          if (pull === "left") {
            return (
              <div key={i} style={{ marginLeft: -32, marginRight: 32 }}>
                {child}
              </div>
            );
          }
          if (pull === "right") {
            return (
              <div key={i} style={{ marginLeft: 32, marginRight: -32 }}>
                {child}
              </div>
            );
          }
          if (pull === "full") {
            return (
              <div key={i} style={{ marginLeft: -48, marginRight: -48 }}>
                {child}
              </div>
            );
          }
          return <div key={i}>{child}</div>;
        })}
      </div>
    );
  }

  if (variant === "broken") {
    // Grid regular con rotaciones y offsets sutiles en items alternados
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap,
          ...style,
        }}
        {...rest}
      >
        {childArr.map((child, i) => {
          const offsetY = i % 3 === 0 ? -8 : i % 3 === 1 ? 12 : 0;
          const rotation = i % 4 === 1 ? -0.4 : i % 4 === 3 ? 0.4 : 0;
          return (
            <div
              key={i}
              style={{
                transform: `translateY(${offsetY}px) rotate(${rotation}deg)`,
                minWidth: 0,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "stacked") {
    // Columna vertical con offsets horizontales alternados (tipo cascade)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          ...style,
        }}
        {...rest}
      >
        {childArr.map((child, i) => {
          const offsetX = i % 3 === 0 ? 0 : i % 3 === 1 ? 16 : -12;
          return (
            <div
              key={i}
              style={{
                marginLeft: offsetX > 0 ? offsetX : 0,
                marginRight: offsetX < 0 ? Math.abs(offsetX) : 0,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    );
  }

  return <div style={style} {...rest}>{children}</div>;
}

/*
  AsymmetricRow — fila horizontal con alineación deliberadamente desbalanceada
  align: "offset-right" | "offset-left" | "scattered" | "stairs"
*/
function AsymmetricRow({ align = "offset-right", gap = 12, children, style = {} }) {
  const childArr = React.Children.toArray(children);

  const verticalOffsets = {
    "offset-right": (i) => (i === childArr.length - 1 ? 12 : 0),
    "offset-left": (i) => (i === 0 ? 12 : 0),
    "scattered": (i) => [0, 8, -6, 14, -4][i % 5],
    "stairs": (i) => i * 6,
  };

  const offsetFn = verticalOffsets[align] || (() => 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap,
        ...style,
      }}
    >
      {childArr.map((child, i) => (
        <div key={i} style={{ transform: `translateY(${offsetFn(i)}px)`, minWidth: 0, flex: 1 }}>
          {child}
        </div>
      ))}
    </div>
  );
}

/*
  PullOutside — elemento que "sale" del contenedor padre editorialmente
  direction: "left" | "right" | "both"
  amount: px que sobresale
*/
function PullOutside({ direction = "left", amount = 24, children, style = {} }) {
  const marginStyle = {
    left: { marginLeft: -amount },
    right: { marginRight: -amount },
    both: { marginLeft: -amount, marginRight: -amount },
  }[direction] || {};

  return (
    <div
      style={{
        position: "relative",
        ...marginStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/*
  Sidenote — nota al margen tipo libro académico
  Flota a la derecha en desktop, bajo el contenido en mobile
*/
function Sidenote({
  children,
  number,           // opcional: número superíndice
  side = "right",   // "right" | "left"
  style = {},
}) {
  const hasHover = useHasHover(); // desktop-ish detection

  const base = {
    fontFamily: FONT_SERIF,
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 1.5,
    color: T.inkMid,
    padding: "8px 14px",
    borderLeft: side === "left" ? `2px solid ${T.gold}` : "none",
    borderRight: side === "right" ? `2px solid ${T.gold}` : "none",
  };

  if (hasHover) {
    // En desktop: flota al margen
    return (
      <aside
        style={{
          float: side,
          width: 180,
          margin: side === "right" ? "4px -40px 12px 20px" : "4px 20px 12px -40px",
          ...base,
          ...style,
        }}
      >
        {number && (
          <sup style={{ color: T.gold, fontWeight: 500, marginRight: 4 }}>{number}</sup>
        )}
        {children}
      </aside>
    );
  }

  // En mobile: inline, separador sutil
  return (
    <aside
      style={{
        margin: "12px 0",
        ...base,
        ...style,
      }}
    >
      {number && <sup style={{ color: T.gold, fontWeight: 500, marginRight: 4 }}>{number}</sup>}
      {children}
    </aside>
  );
}

/*
  GoldenSection — divide espacio en proporción áurea (1.618)
  direction: "horizontal" | "vertical"
  primary: qué lado recibe la proporción grande ("start" | "end")
*/
function GoldenSection({
  direction = "horizontal",
  primary = "start",
  gap = 16,
  children,
  style = {},
}) {
  const childArr = React.Children.toArray(children);
  const [first, second] = childArr;
  const bigFraction = "1.618fr";
  const smallFraction = "1fr";
  const cols = primary === "start"
    ? `${bigFraction} ${smallFraction}`
    : `${smallFraction} ${bigFraction}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: direction === "horizontal" ? cols : undefined,
        gridTemplateRows: direction === "vertical" ? cols : undefined,
        gap,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>{first}</div>
      <div style={{ minWidth: 0 }}>{second}</div>
    </div>
  );
}

/*
  EditorialHeader — encabezado de sección con proporciones editoriales
  Número de sección + título + subtítulo en composición asimétrica
*/
function EditorialHeader({
  number,           // "01", "№ 003", etc.
  title,
  subtitle,
  ornament = true,  // agrega ornamento al final
  style = {},
}) {
  return (
    <header style={{ marginBottom: 32, ...style }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 8,
        }}
      >
        {number && (
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 48,
              fontStyle: "italic",
              fontWeight: 400,
              color: T.gold,
              lineHeight: 1,
              flexShrink: 0,
              transform: "translateY(8px)",
            }}
          >
            {number}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {subtitle && (
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 10,
                fontVariantCaps: "all-small-caps",
                fontFeatureSettings: '"smcp" 1, "c2sc" 1',
                letterSpacing: "0.3em",
                color: T.inkMid,
                marginBottom: 4,
              }}
            >
              {subtitle}
            </div>
          )}
          <h2
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 28,
              fontStyle: "italic",
              fontWeight: 400,
              color: T.ink,
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              fontFeatureSettings: '"liga" 1, "dlig" 1, "swsh" 1',
            }}
          >
            {title}
          </h2>
        </div>
      </div>
      {ornament && (
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${T.gold}, ${T.line}, transparent)`,
            marginTop: 16,
            width: "60%",
          }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}

/* ============================================================
   HOOK & UI — Temporadas narrativas
   ============================================================ */

/* useNarrativeSeason: gestiona firstUseDate + devuelve season actual
   Auto-inicializa firstUseDate en el primer render si no existe. */
function useNarrativeSeason() {
  const [firstUseDate, setFirstUseDate] = useStorage("aura-first-use-date", null);

  // Inicializar en el primer render si no existe
  useEffect(() => {
    if (!firstUseDate) {
      setFirstUseDate(new Date().toISOString());
    }
  }, [firstUseDate, setFirstUseDate]);

  const season = useMemo(() => {
    if (!firstUseDate) return calcNarrativeSeason(new Date().toISOString());
    return calcNarrativeSeason(firstUseDate);
  }, [firstUseDate]);

  // Tint aplicado a T: mezcla sutil (12%) del color temporada sobre T.accent/T.gold
  const tintedColors = useMemo(() => {
    if (!season) return { accent: T.accent, gold: T.gold };
    return {
      accent: mixColors(T.accent, season.tint, 0.12),
      gold: mixColors(T.gold, season.tint, 0.15),
      tintSoft: season.tintSoft,
      tintStrong: season.tint,
    };
  }, [season]);

  const seasonalMantra = useMemo(() => getSeasonalMantra(season), [season]);

  return {
    season,                 // objeto completo con day, progress, etc.
    firstUseDate,
    tintedColors,           // usar estos colores donde querás tinte temporal
    seasonalMantra,         // mantra filtrado por temporada actual
    // Devuelve glyph name listo para AchievementGlyph
    glyphName: season?.glyph || "root",
  };
}

/* Mezcla dos colores hex. ratio = 0 → color1, ratio = 1 → color2 */
/* SeasonBadge — indicador visual compacto de la temporada actual
   Útil para mostrar en headers, menús, o como decoración sutil.
   Variantes: "compact" | "detailed" | "hero" */
function SeasonBadge({
  season,
  variant = "compact",
  showProgress = false,
  style = {},
}) {
  if (!season) return null;

  if (variant === "compact") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 20,
          background: `${season.tint}18`,
          border: `1px solid ${season.tint}40`,
          ...style,
        }}
      >
        <AchievementGlyph name={season.glyph} size={16} color={season.tint} />
        <span
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 13,
            fontStyle: "italic",
            color: season.tint,
            letterSpacing: "0.02em",
          }}
        >
          {season.name}
        </span>
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div
        style={{
          padding: "18px 22px",
          borderRadius: 16,
          background: `linear-gradient(135deg, ${season.tintSoft}22 0%, ${season.tint}10 100%)`,
          border: `1px solid ${season.tint}30`,
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <AchievementGlyph name={season.glyph} size={36} color={season.tint} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 10,
                fontVariantCaps: "all-small-caps",
                fontFeatureSettings: '"smcp" 1, "c2sc" 1',
                letterSpacing: "0.25em",
                color: T.inkMid,
                marginBottom: 2,
              }}
            >
              {season.subtitle} · Día {season.daysIntoSeason} de {season.totalSeasonLength}
            </div>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 22,
                fontStyle: "italic",
                color: season.tint,
                lineHeight: 1.1,
              }}
            >
              {season.name}
            </div>
          </div>
        </div>
        {showProgress && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                height: 2,
                background: `${season.tint}20`,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${season.progress * 100}%`,
                  background: season.tint,
                  transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // variant === "hero"
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 24px",
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 10,
          fontVariantCaps: "all-small-caps",
          fontFeatureSettings: '"smcp" 1, "c2sc" 1',
          letterSpacing: "0.35em",
          color: T.inkMid,
          marginBottom: 14,
        }}
      >
        {season.cycleNumber > 1 ? `Ciclo ${toRoman(season.cycleNumber)} · ` : ""}
        {season.subtitle}
      </div>
      <div style={{ marginBottom: 18 }}>
        <AchievementGlyph name={season.glyph} size={72} color={season.tint} />
      </div>
      <h2
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 44,
          fontStyle: "italic",
          fontWeight: 400,
          color: season.tint,
          margin: 0,
          letterSpacing: "-0.01em",
          fontFeatureSettings: '"liga" 1, "dlig" 1, "swsh" 1',
        }}
      >
        {season.name}
      </h2>
      <p
        style={{
          marginTop: 18,
          maxWidth: 420,
          marginLeft: "auto",
          marginRight: "auto",
          fontFamily: FONT_SERIF,
          fontSize: 15,
          lineHeight: 1.55,
          fontStyle: "italic",
          color: T.inkMid,
        }}
      >
        {season.description}
      </p>
      {showProgress && (
        <div
          style={{
            marginTop: 28,
            maxWidth: 280,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div
            style={{
              height: 1,
              background: `${season.tint}30`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${season.progress * 100}%`,
                background: season.tint,
                transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_SANS,
              fontSize: 10,
              letterSpacing: "0.2em",
              color: T.inkSoft,
              fontVariantCaps: "all-small-caps",
            }}
          >
            Día {season.daysIntoSeason} · {season.daysLeftInSeason} por venir
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper: convertir número a romano (I, II, III, IV...) para ciclos */
/* ============================================================
   CONTEXTUAL REMINDERS — In-app, sin push
   ============================================================
   Analiza los datos que ya tiene Aura y devuelve mensajes
   contextuales. No molesta fuera de la app. No requiere permisos.
   Cada reminder puede ser "dismissed" por 24h/7d/nunca.
*/

/*
  Definición de reminders contextuales.
  Cada reminder tiene:
    - id:          key estable para persistencia
    - priority:    1 (urgente) — 5 (suave). Menor = aparece primero.
    - tone:        "care" | "invitation" | "celebration" | "information"
    - check:       función (ctx) => boolean
    - build:       función (ctx) => { title, body, cta? }
    - dismissHours: cuánto tiempo se oculta tras ser dismissed (default 24)
*/
const CONTEXTUAL_REMINDERS = [
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
      // Silencio en painLog por 3+ días (journal es opcional si existe)
      const daysSincePain = ctx.daysSinceLastPainLog;
      const daysSinceJournal = ctx.daysSinceLastJournal;
      // Solo disparar si hay AL MENOS un registro previo (no usuaria nueva)
      if (daysSincePain === null && daysSinceJournal === null) return false;
      const silent = Math.min(
        daysSincePain ?? Infinity,
        daysSinceJournal ?? Infinity
      );
      return silent >= 3 && silent < 30;
    },
    build: (ctx) => ({
      title: "Un momento para escucharte",
      body: "Hace unos días que no registrás cómo te sentís. No es urgencia — es invitación.",
      cta: null, // sin CTA hasta que se defina a dónde va
    }),
  },
  {
    id: "luteal_gentleness",
    priority: 3,
    tone: "care",
    dismissHours: 48,
    check: (ctx) => {
      return ctx.cyclePhaseName?.toLowerCase?.().includes("lút") ||
             ctx.cyclePhaseName?.toLowerCase?.().includes("lute");
    },
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
    check: (ctx) => {
      return ctx.streak === 6 || ctx.streak === 29;
    },
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
      // Últimos 2 días de la temporada actual
      return ctx.season.daysLeftInSeason >= 0 && ctx.season.daysLeftInSeason <= 2;
    },
    build: (ctx) => {
      const current = ctx.season?.name || "";
      const next =
        current === "Raíz" ? "Bloom"
        : current === "Bloom" ? "Quietud"
        : "Raíz";
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
    dismissHours: 999 * 24, // una sola vez
    check: (ctx) => {
      return ctx.season?.daysSince === 1;
    },
    build: () => ({
      title: "Bienvenida a Aura",
      body: "Esto no es una app para medir. Es un espacio para habitarte.",
      cta: null,
    }),
  },
];

/* Hook que analiza contexto y devuelve reminders activos
   Retorna: { reminders: [...], dismissReminder: (id) => void } */
function useContextualReminders({
  painLog,
  bodyMetrics,
  streak,
  lastPeriod,
  cycleType,
  season,
}) {
  const [dismissed, setDismissed] = useStorage("aura-reminders-dismissed", {});

  // Construir contexto
  const ctx = useMemo(() => {
    const today = new Date();

    // Días desde último painLog
    let daysSinceLastPainLog = null;
    if (Array.isArray(painLog) && painLog.length > 0) {
      const latest = [...painLog].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      if (latest?.date) {
        const d = new Date(latest.date);
        daysSinceLastPainLog = Math.floor((today - d) / 86400000);
      }
    }

    // Días desde último journal entry
    let daysSinceLastJournal = null;
    const safeBody = bodyMetrics && typeof bodyMetrics === "object" ? bodyMetrics : {};
    if (Array.isArray(safeBody.journal) && safeBody.journal.length > 0) {
      const latest = [...safeBody.journal].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      if (latest?.date) {
        const d = new Date(latest.date);
        daysSinceLastJournal = Math.floor((today - d) / 86400000);
      }
    }

    // Fase del ciclo
    let cyclePhaseName = null;
    if (lastPeriod && typeof calcCyclePhase === "function") {
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

  // Filtrar reminders activos (pasan check y no están dismissed)
  const reminders = useMemo(() => {
    const now = Date.now();
    const active = CONTEXTUAL_REMINDERS
      .filter((r) => {
        // ¿Está dismissed y aún no expiró?
        const dismissedAt = dismissed?.[r.id];
        if (dismissedAt) {
          const hoursSinceDismiss = (now - dismissedAt) / 3600000;
          if (hoursSinceDismiss < r.dismissHours) return false;
        }
        // ¿Pasa el check?
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
    return active;
  }, [ctx, dismissed]);

  const dismissReminder = useCallback((id) => {
    setDismissed((prev) => ({ ...(prev || {}), [id]: Date.now() }));
  }, [setDismissed]);

  return {
    reminders,
    topReminder: reminders[0] || null, // el más prioritario
    dismissReminder,
  };
}

/* ─── Componente visual 1: Banner/Toast discreto ─── */
function ReminderBanner({ reminder, onDismiss, onAction, style = {} }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reminder) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [reminder?.id]);

  if (!reminder) return null;

  const toneColors = {
    care: T.accent,
    invitation: T.gold,
    celebration: T.gold,
    information: T.inkMid,
  };
  const accent = toneColors[reminder.tone] || T.accent;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        transition: "all 500ms cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        background: isNightTime()
          ? `rgba(45, 35, 60, 0.6)`
          : `${accent}0D`,
        border: `1px solid ${accent}30`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        ...style,
      }}
      role="status"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 14,
            fontStyle: "italic",
            color: T.ink,
            lineHeight: 1.3,
            marginBottom: 3,
          }}
        >
          {reminder.title}
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 12,
            color: T.inkMid,
            lineHeight: 1.4,
          }}
        >
          {reminder.body}
        </div>
        {reminder.cta && onAction && (
          <button
            onClick={() => onAction(reminder.cta.action)}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "none",
              padding: 0,
              fontFamily: FONT_SANS,
              fontSize: 11,
              fontVariantCaps: "all-small-caps",
              fontFeatureSettings: '"smcp" 1',
              letterSpacing: "0.15em",
              color: accent,
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationThickness: "0.5px",
              textUnderlineOffset: 3,
            }}
          >
            {reminder.cta.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(reminder.id)}
          aria-label="Descartar"
          style={{
            background: "transparent",
            border: "none",
            color: T.inkSoft,
            cursor: "pointer",
            padding: 4,
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.6,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ─── Componente visual 2: Pergamino editorial con ornamento ─── */
function ReminderParchment({ reminder, onDismiss, onAction, style = {} }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reminder) {
      const t = setTimeout(() => setVisible(true), 120);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [reminder?.id]);

  if (!reminder) return null;

  const toneColors = {
    care: T.accent,
    invitation: T.gold,
    celebration: T.gold,
    information: T.inkMid,
  };
  const accent = toneColors[reminder.tone] || T.accent;

  // Ornamento según tono
  const toneGlyph = {
    care: "❧",
    invitation: "❦",
    celebration: "✦",
    information: "❈",
  }[reminder.tone] || "❦";

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
        transition: "all 700ms cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        padding: "26px 28px 22px",
        background: isNightTime()
          ? `linear-gradient(135deg, rgba(45,35,60,0.45) 0%, rgba(36,27,48,0.55) 100%)`
          : `linear-gradient(135deg, ${accent}08 0%, ${accent}15 100%)`,
        border: `1px solid ${accent}25`,
        borderRadius: 14,
        ...style,
      }}
      role="status"
    >
      {/* Ornamento superior centrado */}
      <div
        style={{
          textAlign: "center",
          fontFamily: FONT_SERIF,
          fontSize: 16,
          color: accent,
          letterSpacing: "0.5em",
          opacity: 0.7,
          marginBottom: 14,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {toneGlyph}
      </div>

      {/* Título */}
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 19,
          fontStyle: "italic",
          fontWeight: 400,
          color: T.ink,
          textAlign: "center",
          lineHeight: 1.25,
          marginBottom: 10,
          letterSpacing: "-0.005em",
          fontFeatureSettings: '"liga" 1, "dlig" 1, "swsh" 1',
        }}
      >
        {reminder.title}
      </div>

      {/* Cuerpo */}
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 14,
          lineHeight: 1.55,
          color: T.inkMid,
          textAlign: "center",
          maxWidth: 380,
          marginLeft: "auto",
          marginRight: "auto",
          fontStyle: "italic",
          opacity: 0.9,
        }}
      >
        {reminder.body}
      </div>

      {/* CTA */}
      {reminder.cta && onAction && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => onAction(reminder.cta.action)}
            style={{
              background: "transparent",
              border: `1px solid ${accent}50`,
              color: accent,
              fontFamily: FONT_SANS,
              fontSize: 11,
              fontVariantCaps: "all-small-caps",
              fontFeatureSettings: '"smcp" 1, "c2sc" 1',
              letterSpacing: "0.2em",
              padding: "9px 22px",
              borderRadius: 20,
              cursor: "pointer",
              transition: "all 300ms ease",
            }}
          >
            {reminder.cta.label}
          </button>
        </div>
      )}

      {/* Dismiss sutil esquina */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(reminder.id)}
          aria-label="Descartar"
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            background: "transparent",
            border: "none",
            color: T.inkSoft,
            cursor: "pointer",
            padding: 4,
            fontSize: 12,
            lineHeight: 1,
            opacity: 0.4,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const WORKOUT_DAYS = {
  lunes: {
    title: "Glúteos + hombros",
    subtitle: "Sin press sobre cabeza",
    focus: "Glúteo medio/mayor · Deltoides lateral y posterior",
    duration: 50,
    icon: "🍑",
    exercises: [
      { id: "hip_thrust", name: "Hip thrust con barra", sets: 4, reps: "10-12", rir: "RIR 2", rest: "90s", baseWeight: 40,
        tech: "Barra sobre caderas con almohadilla. Pies al ancho de caderas, ligeramente afuera. Espalda media apoyada. Sube desde talones, contrae 1s arriba.",
        cue: "Empuja el piso con los talones. No arquees lumbar." },
      { id: "bulgaro", name: "Sentadilla búlgara", sets: 3, reps: "10 por pierna", rir: "RIR 2", rest: "60s por lado", baseWeight: 8,
        tech: "Pie trasero en banco. Pie delantero bien separado — con valgus, rodilla delantera NO colapsa hacia adentro.",
        cue: "Rodilla alineada con segundo dedo. Si sientes rodilla, separa más el pie." },
      { id: "kickback_lun", name: "Kickback en polea", sets: 3, reps: "12-15", rir: "RIR 1", rest: "45s", baseWeight: 7,
        tech: "Tobillera en polea baja. Apóyate con las manos, tronco inclinado. Pierna flexionada.",
        cue: "No uses lumbar. La pierna no pasa la línea del cuerpo." },
      { id: "lateral", name: "Elevaciones laterales", sets: 4, reps: "12-15", rir: "RIR 1", rest: "45s", baseWeight: 4,
        tech: "Mancuernas livianas. Codo ligeramente flexionado. Sube hasta línea de hombro.",
        cue: "Si sientes trapecio, baja el peso." },
      { id: "pajaros", name: "Pájaros (rear delt)", sets: 3, reps: "12-15", rir: "RIR 1", rest: "45s", baseWeight: 3,
        tech: "Inclinada en banco o tronco a 45°. Mancuernas livianas. Abre apretando escápulas.",
        cue: "Este ejercicio es oro para tu postura. No lo sacrifiques por peso." },
    ],
  },
  miercoles: {
    title: "Espalda + core + postura",
    subtitle: "Día crítico para tu cuello",
    focus: "Dorsal · Romboides · Core · Cervical · Densidad",
    duration: 45,
    icon: "🪷",
    densityMode: true,
    exercises: [
      { id: "face_pulls", name: "Face pulls", sets: 4, reps: "15", rir: "RIR 1", rest: "30s", baseWeight: 12,
        densityNote: "Descanso 30s para densidad. Foco control.",
        tech: "Polea a altura de la cara, cuerda. Tira hacia la cara separando manos.",
        cue: "Terapia para tu cuello adelantado. No lo saltes nunca." },
      { id: "jalon_supino", name: "Jalón supino", sets: 4, reps: "10-12", rir: "RIR 2", rest: "60s", baseWeight: 25,
        densityNote: "Descanso 60s — densidad.",
        tech: "Palmas hacia ti, agarre ancho de hombros. Tira al pecho alto.",
        cue: "Agarre supino activa más bíceps y dorsal inferior." },
      { id: "remo", name: "Remo sentado en polea", sets: 4, reps: "10-12", rir: "RIR 2", rest: "45s", baseWeight: 22,
        densityNote: "1 serie extra + descanso corto = más densidad.",
        tech: "Agarre neutro. Tronco firme. Lleva mango al abdomen.",
        cue: "Imagina meter los omóplatos en los bolsillos traseros." },
      { id: "dead_bug", name: "Dead bug", sets: 3, reps: "10 por lado", rir: "Control", rest: "30s", baseWeight: 0,
        tech: "Boca arriba. Brazos arriba, piernas 90°. Extiende brazo opuesto a pierna.",
        cue: "Si lumbar se despega, acorta el movimiento." },
      { id: "plancha", name: "Plancha con retracción", sets: 3, reps: "30-40s", rir: "Control", rest: "45s", baseWeight: 0,
        tech: "Antebrazos. Cuerpo recto. Chin tuck, glúteos apretados.",
        cue: "Doble función: core + cervical." },
    ],
  },
  viernes: {
    title: "Pierna + glúteo",
    subtitle: "Día más pesado de tren inferior",
    focus: "Glúteo mayor · Cuádriceps · Isquios",
    duration: 55,
    icon: "🔥",
    exercises: [
      { id: "prensa", name: "Prensa con pie alto", sets: 4, reps: "10-12", rir: "RIR 2", rest: "90s", baseWeight: 80,
        tech: "Pies altos, ancho de caderas. Baja a 90° de rodilla.",
        cue: "Pie alto = más glúteo e isquio, menos rodilla." },
      { id: "rumano", name: "Peso muerto rumano", sets: 4, reps: "10", rir: "RIR 2", rest: "90s", baseWeight: 30,
        tech: "Rodillas ligeramente flexionadas. Barra pegada a piernas hasta mitad canilla.",
        cue: "Movimiento de cadera (bisagra), no de rodilla." },
      { id: "hip_unilateral", name: "Hip thrust unilateral", sets: 3, reps: "10 por lado", rir: "RIR 2", rest: "60s por lado", baseWeight: 15,
        tech: "Hip thrust a una pierna. Otra flexionada al pecho.",
        cue: "Corrige asimetrías. Ve lenta." },
      { id: "kickback_vie", name: "Kickback volumen", sets: 4, reps: "12-15", rir: "RIR 1", rest: "45s", baseWeight: 9,
        tech: "Igual al del lunes pero más volumen.",
        cue: "Último esfuerzo del glúteo en la semana." },
      { id: "abductor", name: "Abductor en máquina", sets: 3, reps: "15", rir: "RIR 1", rest: "45s", baseWeight: 30,
        tech: "Tronco inclinado adelante — más glúteo medio.",
        cue: "Glúteo medio es clave para tu valgus y reloj de arena." },
    ],
  },
};

const NECK_PROTOCOL = [
  { id: "chin_tuck", name: "Chin tuck", duration: 60, reps: "10 reps · 3s aguanta",
    tech: "Sentada o de pie, espalda recta. Mete la barbilla hacia el cuello. NO mires hacia abajo.",
    cue: "Ejercicio #1 para tu cuello adelantado." },
  { id: "levator", name: "Levator scapulae", duration: 90, reps: "45s por lado",
    tech: "Mira hacia tu axila opuesta. Con mano del mismo lado, ligera presión en la cabeza.",
    cue: "Culpable #1 del dolor arriba del omóplato." },
  { id: "trap_sup", name: "Trapecio superior", duration: 90, reps: "45s por lado",
    tech: "Oreja al hombro. Con mano del mismo lado, ligera presión.",
    cue: "Respira profundo. Suelta tensión al exhalar." },
  { id: "pec", name: "Pectoral en puerta", duration: 90, reps: "45s por lado",
    tech: "Brazo en marco, codo 90°, antebrazo apoyado. Paso adelante.",
    cue: "Tu pectoral acortado es por qué los hombros van adelante." },
  { id: "wall", name: "Retracción en pared", duration: 60, reps: "10 reps · 5s aguanta",
    tech: "De pie en pared: cabeza, escápulas y glúteo tocando. Brazos en W.",
    cue: "Al principio cuesta — significa que lo necesitas." },
];

const REWARDS = {
  fitness_food: { label: "Comida fitness", icon: "🍦", examples: ["Helado proteico", "Postre gluten-free", "Chocolate 85%"] },
  selfcare: { label: "Autocuidado", icon: "💆", examples: ["Masaje", "Mani/pedi", "Ropa deportiva"] },
  rest: { label: "Descanso activo", icon: "🌿", examples: ["Película", "Día libre", "Paseo con Oreo y Blanquita"] },
  custom: { label: "Libre", icon: "✨", examples: ["Lo que tú elijas"] },
};

const MONTHLY_CHALLENGES = [
  { id: "strength", label: "Fuerza", icon: "💪",
    target: "Progresar en hip thrust, rumano y jalón supino",
    criteria: "+1 escalón de peso o +1 rep vs. mes anterior" },
  { id: "composition", label: "Composición", icon: "📏",
    target: "4 registros de peso + 1 medida + 1 foto al mes",
    criteria: "Constancia en registro, no el número" },
  { id: "habits", label: "Hábitos", icon: "🌸",
    target: "≥80% adherencia: gym + cuello + nutrición + sueño",
    criteria: "Registro diario de los 4 pilares" },
];

const PILATES_ROUTINES = {
  core: {
    title: "Core + estabilidad", duration: 30, focus: "Transverso abdominal · Lumbar · Pelvis", icon: "🌿",
    exercises: ["Hundred · 100 tiempos", "Single leg stretch · 10 por pierna", "Double leg stretch · 10 reps",
                "Criss-cross · 10 por lado", "Spine stretch forward · 5 reps", "Swan prep · 8 reps"],
  },
  postura: {
    title: "Postura + cuello", duration: 25, focus: "Escápulas · Cervical · Cadena posterior", icon: "🪷",
    exercises: ["Chest lift con retracción · 10 reps", "Swimming lento · 30s × 3", "Cat-cow · 8 reps",
                "Thread the needle · 5 por lado", "Child's pose con brazos · 1 min", "Cobra suave · 8 reps"],
  },
  pierna: {
    title: "Pierna + glúteo", duration: 35, focus: "Glúteo medio · Aductores · Cadera", icon: "🌸",
    exercises: ["Side-lying leg lifts · 15 por lado", "Clamshells · 15 por lado", "Fire hydrants · 12 por lado",
                "Bridge con pulse · 20 reps", "Inner thigh lifts · 15 por lado", "Hip circles · 10 por lado"],
  },
};

const BODY_METRICS = [
  { id: "weight", label: "Peso", unit: "kg", freq: "semanal" },
  { id: "waist", label: "Cintura", unit: "cm", freq: "mensual" },
  { id: "hip", label: "Cadera", unit: "cm", freq: "mensual" },
  { id: "thigh", label: "Muslo", unit: "cm", freq: "mensual" },
];

const PAIN_ZONES = [
  { id: "neck", label: "Cuello" },
  { id: "trap", label: "Trapecios" },
  { id: "lumbar", label: "Lumbar" },
  { id: "knee", label: "Rodillas" },
  { id: "breath", label: "Respiración" },
];

const NUTRITION_PRINCIPLES = [
  { title: "Déficit moderado",
    body: "Para bajar 10 kg sin efecto rebote: 0.5-0.75 kg por semana. Déficit de 400-500 kcal sobre tu mantenimiento." },
  { title: "Proteína alta",
    body: "1.6-2.0 g por kg de peso objetivo. Para ti, unos 100-120 g al día. Preserva músculo y te mantiene saciada." },
  { title: "Gluten-free antiinflamatorio",
    body: "Ya lo haces bien. Mantén: arroz, quinoa, papa, yuca, proteína magra, verduras, grasas buenas." },
  { title: "Hidratación",
    body: "2.5-3 litros al día. La sed se confunde con hambre por la noche." },
];

const ANXIETY_NIGHT = [
  "Cena suficiente — si llegas con hambre extrema, pierdes.",
  "Té de manzanilla, tila o melisa 30 min antes de dormir.",
  "Snack legal: yogur griego con canela, o manzana con almendras.",
  "Pausa de 10 minutos antes de comer. Respiración 4-7-8.",
  "Registra los momentos — patrón de estrés, no de hambre.",
];

const COACH_SYSTEM = `Eres la coach personal de Fer en Aura.
Contexto: 156 cm, 70 kg, meta -10 kg. Glúteos/pierna fuerte. Valgus, cuello adelantado.
Dieta gluten-free. 3 gym + Pilates. Ansiedad nocturna.
Estilo: cálido, directo, español. 3-5 frases. Sin emojis. Voz editorial.`;

function useClaudeCoach() {
  const [loading, setLoading] = useState(false);
  const ask = async (prompt, systemContext = COACH_SYSTEM) => {
    setLoading(true);
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemContext, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      setLoading(false);
      return data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "";
    } catch (e) {
      setLoading(false);
      return null;
    }
  };
  return { ask, loading };
}

// ---------- UI BASE ----------
const Card = ({ children, style, glass = false, onClick }) => (
  <div onClick={onClick} style={{
    background: glass ? T.cardGlass : T.card,
    backdropFilter: glass ? "blur(20px) saturate(1.2)" : "none",
    WebkitBackdropFilter: glass ? "blur(20px) saturate(1.2)" : "none",
    borderRadius: 22, padding: 22,
    border: `1px solid ${glass ? "rgba(234, 221, 210, 0.6)" : T.line}`,
    boxShadow: SHADOW_CARD,
    transition: `all ${TX_SMOOTH}`,
    cursor: onClick ? "pointer" : "default",
    position: "relative", overflow: "hidden",
    ...style,
  }}>{children}</div>
);

const GradientCard = ({ children, gradient = GRADIENTS.aurora, style, onClick }) => (
  <div onClick={onClick} style={{
    background: gradient, borderRadius: 22, padding: 22,
    boxShadow: SHADOW_HERO, position: "relative", overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    ...style,
  }}>{children}</div>
);

const Label = ({ children, color = T.inkSoft, style }) => (
  <div style={{
    fontSize: 11, color, letterSpacing: 1,
    textTransform: "uppercase", fontWeight: 500, ...style,
  }}>{children}</div>
);

const H2 = ({ children, style }) => (
  <h2 style={{
    fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 400,
    margin: 0, color: T.ink, letterSpacing: -0.2, ...style,
  }}>{children}</h2>
);

const H3 = ({ children, style }) => (
  <h3 style={{
    fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 400,
    margin: 0, color: T.ink, lineHeight: 1.2, ...style,
  }}>{children}</h3>
);

const Pill = ({ children, color = T.accent, style }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "5px 11px", borderRadius: 999,
    background: `${color}20`, color,
    fontSize: 11, fontWeight: 500, letterSpacing: 0.3, ...style,
  }}>{children}</span>
);

const Button = ({ children, onClick, variant = "primary", disabled, style, fullWidth }) => {
  const styles = {
    primary: { background: T.accentDeep, color: "white", border: `1px solid ${T.accentDeep}` },
    soft: { background: T.accent, color: "white", border: `1px solid ${T.accent}` },
    ghost: { background: "transparent", color: T.accentDeep, border: `1px solid ${T.accentDeep}` },
    subtle: { background: T.bgAlt, color: T.ink, border: `1px solid ${T.line}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "12px 20px", borderRadius: 999,
      fontSize: 13, fontWeight: 500,
      cursor: disabled ? "default" : "pointer",
      fontFamily: FONT_SANS, opacity: disabled ? 0.5 : 1,
      transition: `all ${TX_FAST}`, letterSpacing: 0.2,
      width: fullWidth ? "100%" : "auto",
      ...styles[variant], ...style,
    }}>{children}</button>
  );
};

const ProgressBar = ({ value, max, color = T.accentDeep, height = 6 }) => {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height, background: T.line, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
      <div style={{
        width: `${pct}%`, height: "100%",
        background: `linear-gradient(90deg, ${T.accent}, ${color})`,
        borderRadius: 999, transition: `width ${TX_SMOOTH}`,
      }} />
    </div>
  );
};

const inputStyle = {
  padding: 10, border: `1px solid ${T.line}`, borderRadius: 10,
  fontSize: 13, background: T.bg, textAlign: "center",
  fontFamily: FONT_SANS, color: T.ink, outline: "none",
  width: "100%", boxSizing: "border-box",
  transition: `border-color ${TX_FAST}`,
};

const FadeIn = ({ children, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: `all 600ms cubic-bezier(0.4, 0, 0.2, 1)`,
    }}>{children}</div>
  );
};

// Editorial sections helpers
const EditorialKicker = ({ children }) => (
  <div style={{
    fontSize: 10, color: T.accentDeep, letterSpacing: 5,
    textTransform: "uppercase", fontWeight: 600,
  }}>{children}</div>
);

const EditorialHero = ({ line1, line2, subtitle }) => (
  <FadeIn>
    {line1 && (
      <>
        <h1 style={{
          fontFamily: FONT_SERIF, fontSize: 46, fontWeight: 400,
          margin: "12px 0 0 0", letterSpacing: -1.2, lineHeight: 0.95,
          color: T.ink,
        }}>{line1}</h1>
        <h1 style={{
          fontFamily: FONT_SERIF, fontSize: 46, fontWeight: 400,
          margin: 0, letterSpacing: -1.2, lineHeight: 0.95,
          color: T.ink, fontStyle: "italic",
        }}>{line2}</h1>
      </>
    )}
    {subtitle && (
      <p style={{
        marginTop: 14, paddingTop: 14,
        borderTop: `1px solid ${T.line}`,
        fontSize: 13, color: T.inkMid, lineHeight: 1.5,
        maxWidth: 380,
      }}>{subtitle}</p>
    )}
  </FadeIn>
);

const SectionHeader = ({ roman, title, subtitle }) => (
  <div style={{ marginTop: 28 }}>
    <div style={{
      fontSize: 10, color: T.accentDeep, letterSpacing: 3,
      textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
    }}>
      {roman} · {title}
    </div>
    {subtitle && (
      <p style={{ fontSize: 13, color: T.inkMid, margin: "0 0 16px 0", lineHeight: 1.5 }}>
        {subtitle}
      </p>
    )}
  </div>
);

// Confetti botánico
function BotanicalConfetti({ show }) {
  if (!show) return null;
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 500,
    duration: 2500 + Math.random() * 1500,
    rotate: Math.random() * 360,
    type: Math.random() > 0.6 ? "leaf" : Math.random() > 0.3 ? "petal" : "dot",
    color: [T.accent, T.gold, T.success, T.accentDeep][Math.floor(Math.random() * 4)],
    size: 8 + Math.random() * 10,
  }));
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      zIndex: 9998, overflow: "hidden",
    }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.left}%`, top: "-20px",
          animation: `fallDown ${p.duration}ms cubic-bezier(0.3, 0.6, 0.7, 1) ${p.delay}ms forwards`,
          transform: `rotate(${p.rotate}deg)`,
        }}>
          {p.type === "leaf" && (
            <svg width={p.size * 1.5} height={p.size} viewBox="0 0 20 12">
              <path d="M 2 6 Q 10 0, 18 6 Q 10 12, 2 6" fill={p.color} opacity="0.7" />
            </svg>
          )}
          {p.type === "petal" && (
            <svg width={p.size} height={p.size} viewBox="0 0 12 12">
              <ellipse cx="6" cy="6" rx="3" ry="5.5" fill={p.color} opacity="0.6" />
            </svg>
          )}
          {p.type === "dot" && (
            <div style={{ width: p.size * 0.4, height: p.size * 0.4, borderRadius: "50%", background: p.color, opacity: 0.7 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function EditorialMantra({ mantra: mantraProp } = {}) {
  const mantra = mantraProp || getMantraOfDay();
  return (
    <FadeIn delay={220}>
      <div style={{ margin: "32px 0 8px 0", padding: "34px 8px 30px 8px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 30, height: 1, background: T.accentDeep, opacity: 0.3 }} />
          <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600 }}>Hoy</div>
          <div style={{ width: 30, height: 1, background: T.accentDeep, opacity: 0.3 }} />
        </div>
        <div style={{
          fontFamily: FONT_SERIF, fontSize: 32, fontStyle: "italic",
          color: T.ink, lineHeight: 1.25, fontWeight: 400,
          letterSpacing: -0.5, maxWidth: 380, margin: "0 auto",
        }}>"{mantra}"</div>
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.accentDeep, opacity: 0.4 }} />
          <div style={{ width: 16, height: 1, background: T.accentDeep, opacity: 0.4 }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold }} />
          <div style={{ width: 16, height: 1, background: T.accentDeep, opacity: 0.4 }} />
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.accentDeep, opacity: 0.4 }} />
        </div>
      </div>
    </FadeIn>
  );
}

// Ilustraciones SVG
const Illustration = ({ type, size = 60, color = T.accentDeep, stroke = 1.5 }) => {
  const s = size;
  const props = { stroke: color, strokeWidth: stroke, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "menstrual") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <path {...props} d="M 20 15 Q 25 22, 25 30 Q 25 37, 20 37 Q 15 37, 15 30 Q 15 22, 20 15 Z" />
      <path {...props} d="M 40 25 Q 44 31, 44 37 Q 44 42, 40 42 Q 36 42, 36 37 Q 36 31, 40 25 Z" />
      <path {...props} d="M 30 42 Q 33 47, 33 51 Q 33 54, 30 54 Q 27 54, 27 51 Q 27 47, 30 42 Z" />
    </svg>
  );
  if (type === "folicular") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <path {...props} d="M 30 50 L 30 25" />
      <path {...props} d="M 30 32 Q 20 28, 16 20 Q 24 20, 30 30" />
      <path {...props} d="M 30 28 Q 40 24, 44 16 Q 36 16, 30 26" />
      <circle cx="30" cy="22" r="3" {...props} />
    </svg>
  );
  if (type === "ovulatoria") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="5" fill={color} opacity="0.6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const x = 30 + 18 * Math.cos(rad);
        const y = 30 + 18 * Math.sin(rad);
        return <ellipse key={i} cx={x} cy={y} rx="4" ry="8"
          transform={`rotate(${a + 90} ${x} ${y})`} {...props} opacity="0.85" />;
      })}
    </svg>
  );
  if (type === "lutea") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <path {...props} d="M 35 15 Q 20 20, 20 32 Q 20 44, 35 48 Q 28 40, 28 32 Q 28 23, 35 15 Z" />
      <path {...props} d="M 42 35 Q 48 32, 52 36 Q 48 40, 42 38" />
    </svg>
  );
  if (type === "gym") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <circle cx="30" cy="18" r="5" {...props} />
      <path {...props} d="M 30 23 L 30 38" />
      <path {...props} d="M 18 32 L 30 28 L 42 32" />
      <path {...props} d="M 22 50 L 30 38 L 38 50" />
    </svg>
  );
  if (type === "pilates") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <circle cx="22" cy="20" r="4" {...props} />
      <path {...props} d="M 22 24 Q 28 32, 38 32 Q 46 32, 48 28" />
      <path {...props} d="M 22 24 Q 18 34, 22 44 Q 26 48, 34 48" />
    </svg>
  );
  if (type === "neck") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <circle cx="30" cy="15" r="6" {...props} />
      <path {...props} d="M 30 21 L 30 32" />
      <circle cx="30" cy="26" r="10" {...props} opacity="0.3" strokeDasharray="2 3" />
      <path {...props} d="M 20 38 L 30 32 L 40 38" />
    </svg>
  );
  if (type === "body") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <ellipse cx="30" cy="16" rx="5" ry="6" {...props} />
      <path {...props} d="M 24 28 Q 30 24, 36 28 L 38 38 Q 30 42, 22 38 Z" />
      <path {...props} d="M 22 38 Q 20 46, 24 52" />
      <path {...props} d="M 38 38 Q 40 46, 36 52" />
    </svg>
  );
  if (type === "heart") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <path {...props} d="M 30 48 Q 12 38, 12 24 Q 12 14, 22 14 Q 28 14, 30 20 Q 32 14, 38 14 Q 48 14, 48 24 Q 48 38, 30 48 Z" />
    </svg>
  );
  if (type === "leaf") return (
    <svg width={s} height={s} viewBox="0 0 60 60">
      <path {...props} d="M 15 45 Q 15 25, 35 15 Q 50 15, 50 30 Q 50 45, 30 50 Q 20 50, 15 45 Z" />
      <path {...props} d="M 15 45 Q 25 38, 45 20" />
    </svg>
  );
  return null;
};

const MoonPhase = ({ phase, size = 40 }) => {
  const phases = { menstrual: "🌑", folicular: "🌒", ovulatoria: "🌕", lutea: "🌖" };
  return <span style={{ fontSize: size, filter: "drop-shadow(0 2px 8px rgba(180,130,110,0.2))" }}>{phases[phase] || "🌙"}</span>;
};

// Anillo de contexto total
function ContextoTotalRing({ energy, cyclePhase, recovery, weekProgress, streak }) {
  const rings = [
    { r: 78, color: T.accent, value: energy, total: 490, speed: 90 },
    { r: 65, color: T.gold, value: cyclePhase, total: 408, speed: 60 },
    { r: 52, color: T.accentDeep, value: recovery, total: 327, speed: 45 },
    { r: 39, color: T.success, value: weekProgress, total: 245, speed: 30 },
  ];
  return (
    <div style={{ position: "relative", width: 220, height: 220 }}>
      <div style={{
        position: "absolute", inset: -20,
        background: `radial-gradient(circle, ${T.accent}40 0%, ${T.gold}20 40%, transparent 70%)`,
        filter: "blur(24px)",
        animation: "breathe 4s ease-in-out infinite",
      }} />
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: "relative" }}>
        <circle cx="110" cy="110" r="92" fill="none" stroke={T.line} strokeWidth="1" opacity="0.6" />
        {rings.map((ring, i) => (
          <g key={i} style={{
            animation: `slowRotate ${ring.speed}s linear infinite`,
            transformOrigin: "110px 110px",
          }}>
            <g transform="rotate(-90 110 110)">
              <circle cx="110" cy="110" r={ring.r} fill="none"
                stroke={ring.color} strokeWidth="11"
                strokeDasharray={`${(ring.value / 100) * ring.total} ${ring.total}`}
                strokeLinecap="round"
                style={{ transition: `stroke-dasharray 1.4s cubic-bezier(0.4, 0, 0.2, 1)` }}
              />
            </g>
          </g>
        ))}
        <text x="110" y="105" textAnchor="middle" fontFamily={FONT_SERIF} fontSize="42" fontWeight="400" fill={T.ink}
          style={{ fontStyle: "italic", letterSpacing: -1 }}>{streak}</text>
        <text x="110" y="128" textAnchor="middle" fontFamily={FONT_SANS} fontSize="9" fill={T.inkMid} letterSpacing="2.5">
          DÍAS · RACHA
        </text>
      </svg>
    </div>
  );
}

// ==================== HOME ====================
function PageHome({ goTo, coach, weeklyStatus, currentStreak, energy, setEnergy,
  lastPeriod, cycleType, painLog, setPainLog, userName = "Fer",
  historialEj, sesionesGym, sesionesPilates, sesionesCuello,
  cycleHistory, cycleSymptoms, bodyMetrics }) {
  const [readiness, setReadiness] = useState("");
  const [input, setInput] = useState("");

  // Sistema de achievements: detecta desbloqueos y gestiona reveal
  const achievements = useAchievements({
    streak: currentStreak,
    sesionesGym, sesionesPilates, sesionesCuello,
    bodyMetrics, painLog, cycleHistory, lastPeriod, cycleType,
  });

  // Temporada narrativa actual (Raíz / Bloom / Quietud) + mantra estacional
  const { season, seasonalMantra } = useNarrativeSeason();

  // Reminder contextual activo (si alguno pasa sus condiciones)
  const { topReminder, dismissReminder } = useContextualReminders({
    painLog, bodyMetrics, streak: currentStreak,
    lastPeriod, cycleType, season,
  });

  const cycleInfo = calcCyclePhase(lastPeriod, 28, cycleType || "regular");
  const weather = useWeather();
  const dayOfWeek = DAY_OF_WEEK();

  const askReadiness = async () => {
    if (!input.trim()) return;
    const cycleContext = cycleInfo
      ? `Fase: ${cycleInfo.data.name} día ${cycleInfo.dayOfCycle}.`
      : "";
    const r = await coach.ask(`Energía: ${energy}. ${cycleContext} Notas: ${input}.`);
    if (r) setReadiness(r);
  };

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  const energyPct = energy === "alta" ? 90 : energy === "media" ? 60 : 30;
  const recoveryPct = energy === "alta" ? 85 : energy === "media" ? 65 : 40;
  const weekPct = ((weeklyStatus.gym + weeklyStatus.pilates + weeklyStatus.neck) / 13) * 100;
  const cyclePct = cycleInfo
    ? (cycleInfo.phase === "ovulatoria" ? 95 : cycleInfo.phase === "folicular" ? 75
       : cycleInfo.phase === "lutea" ? 45 : 25)
    : 50;
  const readinessPct = Math.round((energyPct + recoveryPct + weekPct + cyclePct) / 4);

  return (
    <div>
      {/* Overlay fullscreen cuando se desbloquea un logro */}
      <AchievementReveal
        achievement={achievements.currentReveal}
        onDismiss={achievements.dismissCurrentReveal}
      />
      <FadeIn>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <div style={{
            position: "absolute", left: -4, top: 10,
            transform: "rotate(-90deg)", transformOrigin: "left top",
            fontSize: 9, color: T.inkSoft, letterSpacing: 4,
            textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap",
          }}>{today.toUpperCase()}</div>
          <div style={{ paddingLeft: 28 }}>
            <div style={{ fontSize: 10, color: T.accentDeep, letterSpacing: 5, textTransform: "uppercase", fontWeight: 600 }}>
              №{String(Math.floor(Date.now() / 86400000) % 365).padStart(3, "0")} · Aura
            </div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 54, fontWeight: 400,
              margin: "10px 0 0 0", letterSpacing: -1.5, lineHeight: 0.95, color: T.ink,
            }}>{getContextualGreeting()},</h1>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 54, fontWeight: 400,
              margin: 0, letterSpacing: -1.5, lineHeight: 0.95,
              color: T.ink, fontStyle: "italic",
            }}>{userName}.</h1>
            <div style={{
              marginTop: 14, paddingTop: 14,
              borderTop: `1px solid ${T.line}`,
              fontSize: 13, color: T.inkMid, lineHeight: 1.5, maxWidth: 380,
            }}>{getDayMessage()}</div>
            {weather && (
              <div style={{ marginTop: 14 }}>
                <WeatherBadge weather={weather} />
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {cycleInfo ? (
        <FadeIn delay={150}>
          <GradientCard gradient={GRADIENTS.aurora} style={{ marginTop: 22, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                  Tu ciclo · {cycleInfo.data.name}
                </div>
                <div style={{
                  fontFamily: FONT_SERIF, fontSize: 96, lineHeight: 0.9,
                  color: T.ink, marginTop: 12, letterSpacing: -3, fontWeight: 400,
                }}>{cycleInfo.dayOfCycle}</div>
                <div style={{ fontSize: 11, color: T.ink, opacity: 0.6, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
                  día del ciclo
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <MoonPhase phase={cycleInfo.phase} size={44} />
                <div style={{
                  marginTop: 12, padding: "6px 12px",
                  background: "rgba(255,255,255,0.5)", borderRadius: 999,
                  fontSize: 10, color: T.ink, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500,
                }}>energía {cycleInfo.data.energy}</div>
              </div>
            </div>
            <div style={{
              marginTop: 22, paddingTop: 18,
              borderTop: `1px solid rgba(58,43,38,0.1)`,
              fontFamily: FONT_SERIF, fontSize: 15, fontStyle: "italic",
              color: T.ink, lineHeight: 1.5, opacity: 0.85,
            }}>"{cycleInfo.data.mood}"</div>
          </GradientCard>
        </FadeIn>
      ) : (
        <FadeIn delay={150}>
          <GradientCard gradient={GRADIENTS.lunar} style={{ marginTop: 22 }} onClick={() => goTo("cycle")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: T.ink, opacity: 0.7 }}>
                  Configura tu experiencia
                </div>
                <h2 style={{
                  fontFamily: FONT_SERIF, fontSize: 28, margin: "10px 0 0 0",
                  color: T.ink, lineHeight: 1.1, fontWeight: 400,
                }}>Tu ciclo,<br/><em>tu ritmo.</em></h2>
              </div>
              <MoonPhase phase="folicular" size={42} />
            </div>
          </GradientCard>
        </FadeIn>
      )}

      <EditorialMantra mantra={seasonalMantra} />

      {/* Reminder contextual (se muestra solo si hay alguno activo) */}
      {topReminder && (
        <FadeIn delay={280}>
          <div style={{ margin: "0 0 24px 0" }}>
            <ReminderParchment
              reminder={topReminder}
              onDismiss={dismissReminder}
              onAction={(action) => {
                if (action === "journal") goTo("body");
              }}
            />
          </div>
        </FadeIn>
      )}

      {/* Ornamento sutil entre mantra y secciones funcionales */}
      <Ornament variant="fleuron" spacing={8} />

      <WeatherCard weather={weather} dayOfWeek={dayOfWeek} />

      <FadeIn delay={350}>
        <Card glass style={{ padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                I · Contexto total
              </div>
              <H3 style={{ marginTop: 6, fontSize: 18 }}>Tu día en una mirada</H3>
            </div>
            <div style={{
              padding: "6px 12px", background: GRADIENTS.gold,
              borderRadius: 999, fontSize: 11, color: T.ink, fontWeight: 600,
            }}>{readinessPct}%</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 22px 0" }}>
            <TiltCard intensity={0.3} maxRotation={4} scale={1.01}>
              <ContextoTotalRing
                energy={energyPct} cyclePhase={cyclePct}
                recovery={recoveryPct} weekProgress={weekPct}
                streak={currentStreak} />
            </TiltCard>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
            <ContextRow color={T.accent} label="Energía" value={`${energy.charAt(0).toUpperCase() + energy.slice(1)}`} />
            <ContextRow color={T.gold} label="Ciclo"
              value={cycleInfo ? `${cycleInfo.data.name} · d${cycleInfo.dayOfCycle}` : "Sin registrar"} />
            <ContextRow color={T.accentDeep} label="Recuperación" value={`${recoveryPct}%`} />
            <ContextRow color={T.success} label="Semana" value={`${weeklyStatus.gym + weeklyStatus.pilates + weeklyStatus.neck} de 13`} />
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={500}>
        <SectionHeader roman="II" title="Cómo estás" />
        <Card glass>
          <div style={{ display: "flex", gap: 8 }}>
            {["alta", "media", "baja"].map((e) => (
              <button key={e} onClick={() => setEnergy(e)} style={{
                flex: 1, padding: "14px 4px", borderRadius: 14,
                border: `1px solid ${energy === e ? T.accentDeep : T.line}`,
                background: energy === e
                  ? `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`
                  : "rgba(255,255,255,0.5)",
                color: energy === e ? "white" : T.ink,
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: FONT_SANS, textTransform: "capitalize",
                transition: `all ${TX_BOUNCY}`,
                transform: energy === e ? "scale(1.02)" : "scale(1)",
              }}>{e}</button>
            ))}
          </div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Cuéntale a tu coach cómo te sientes..."
            rows={2}
            style={{
              width: "100%", marginTop: 14, padding: 14,
              border: `1px solid ${T.line}`, borderRadius: 14,
              fontFamily: FONT_SANS, fontSize: 14, color: T.ink,
              background: "rgba(251, 241, 233, 0.7)", resize: "none", outline: "none",
              boxSizing: "border-box", lineHeight: 1.5,
            }} />
          <Button onClick={askReadiness} disabled={coach.loading} style={{ marginTop: 12 }} fullWidth>
            {coach.loading ? "Escuchándote..." : "Preguntar a tu coach"}
          </Button>
          {readiness && (
            <div style={{ marginTop: 14 }}>
              <PullQuote attribution="Aura">
                {readiness}
              </PullQuote>
            </div>
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={650}>
        <SectionHeader roman="III" title="Esta semana" />
        <Card glass>
          <ChallengeRow label="Sesiones de gym" value={weeklyStatus.gym} max={3} />
          <ChallengeRow label="Pilates" value={weeklyStatus.pilates} max={3} />
          <ChallengeRow label="Protocolo de cuello" value={weeklyStatus.neck} max={7} />
          <Button onClick={() => goTo("challenges")} variant="ghost" style={{ marginTop: 14 }} fullWidth>
            Ver retos y recompensas
          </Button>
        </Card>
      </FadeIn>

      <FadeIn delay={800}>
        <SectionHeader roman="IV" title="Accesos" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ActionTile label="Hoy" title="Entrenamiento" subtitle="Ve a tu sesión"
            illustration="gym" color={T.accentDeep} onClick={() => goTo("gym")} />
          <ActionTile label="Diario" title="Cuello" subtitle="10 min"
            illustration="neck" color={T.gold} onClick={() => goTo("neck")} />
          <ActionTile label="Ciclo" title={cycleInfo ? cycleInfo.data.name : "Configurar"}
            subtitle={cycleInfo ? `Día ${cycleInfo.dayOfCycle}` : "Empezar"}
            illustration={cycleInfo ? cycleInfo.phase : "folicular"}
            color={cycleInfo ? cycleInfo.data.color : T.accent}
            onClick={() => goTo("cycle")} />
          <ActionTile label="Pilates" title="Movimiento" subtitle="Control"
            illustration="pilates" color={T.success} onClick={() => goTo("pilates")} />
          <ActionTile label="Cuerpo" title="Composición" subtitle="Tu progreso"
            illustration="body" color={T.accent} onClick={() => goTo("body")} />
          <ActionTile label="Principios" title="Nutrición" subtitle="Cuidarte"
            illustration="leaf" color={T.success} onClick={() => goTo("nutrition")} />
        </div>
      </FadeIn>

      <FadeIn delay={950}>
        <PainTracker painLog={painLog} setPainLog={setPainLog} />
      </FadeIn>

      <YearReviewTrigger
        historialEj={historialEj}
        sesionesGym={sesionesGym}
        sesionesPilates={sesionesPilates}
        sesionesCuello={sesionesCuello}
        cycleHistory={cycleHistory}
        cycleSymptoms={cycleSymptoms}
        userName={userName}
        painLog={painLog} />

      <FadeIn delay={1100}>
        <Card style={{ marginTop: 16, background: `${T.warn}12`, border: `1px solid ${T.warn}30` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, marginTop: 6, flexShrink: 0 }} />
            <div>
              <Label color={T.warn}>Importante</Label>
              <p style={{ margin: "6px 0 0 0", fontSize: 14, color: T.ink, lineHeight: 1.55 }}>
                Pendiente consulta médica por respiración y nutricionista para ansiedad nocturna.
              </p>
            </div>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}

const ContextRow = ({ color, label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ color: T.ink, fontWeight: 500, fontSize: 13 }}>{label}</div>
      <div style={{ color: T.inkSoft, fontSize: 11, marginTop: 1 }}>{value}</div>
    </div>
  </div>
);

const ChallengeRow = ({ label, value, max }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ color: T.ink, fontWeight: 500, fontSize: 13 }}>{label}</span>
      <span style={{ color: T.inkMid, fontSize: 12, fontFamily: FONT_SERIF }}>
        <span style={{ fontSize: 15, color: T.ink }}>{value}</span> / {max}
      </span>
    </div>
    <ProgressBar value={value} max={max} />
  </div>
);

const ActionTile = ({ label, title, subtitle, color, onClick, illustration }) => (
  <button onClick={onClick} style={{
    background: "rgba(255, 255, 255, 0.65)",
    backdropFilter: "blur(20px) saturate(1.2)",
    WebkitBackdropFilter: "blur(20px) saturate(1.2)",
    border: `1px solid rgba(234, 221, 210, 0.6)`,
    borderRadius: 20, padding: 18, textAlign: "left",
    cursor: "pointer", fontFamily: FONT_SANS,
    boxShadow: SHADOW_CARD, transition: `all ${TX_SMOOTH}`,
    position: "relative", overflow: "hidden", minHeight: 130,
  }}>
    {illustration && (
      <div style={{ position: "absolute", top: 10, right: 10, opacity: 0.25 }}>
        <Illustration type={illustration} size={54} color={color} stroke={1.2} />
      </div>
    )}
    <Label>{label}</Label>
    <H3 style={{ marginTop: 6, lineHeight: 1.2, fontSize: 16 }}>{title}</H3>
    <div style={{ fontSize: 11, color, marginTop: 8, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
      {subtitle}
    </div>
  </button>
);

// Dolor tracker
function PainTracker({ painLog = [], setPainLog }) {
  const [showForm, setShowForm] = useState(false);
  const [zone, setZone] = useState(null);
  const [level, setLevel] = useState(3);
  const [note, setNote] = useState("");
  const safePainLog = Array.isArray(painLog) ? painLog : [];

  const handleSave = () => {
    if (!zone) return;
    const entry = { date: todayStr(), zone, level, note };
    const filtered = safePainLog.filter((p) => !(p.date === todayStr() && p.zone === zone));
    setPainLog([...filtered, entry]);
    setShowForm(false);
    setZone(null);
    setNote("");
    setLevel(3);
  };

  const getAvgLevel = (zoneId) => {
    const entries = safePainLog.filter((p) => p.zone === zoneId).slice(-7);
    if (entries.length === 0) return null;
    return entries.reduce((s, e) => s + e.level, 0) / entries.length;
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Label>Diario de molestias</Label>
          <H3 style={{ marginTop: 4, fontSize: 16 }}>¿Cómo te sientes?</H3>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="subtle">
          {showForm ? "Cerrar" : "+ Registrar"}
        </Button>
      </div>
      {showForm && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.lineSoft}` }}>
          <Label>Zona</Label>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {PAIN_ZONES.map((z) => (
              <button key={z.id} onClick={() => setZone(z.id)} style={{
                padding: "8px 12px", borderRadius: 999,
                border: `1px solid ${zone === z.id ? T.accentDeep : T.line}`,
                background: zone === z.id ? T.accentDeep : T.card,
                color: zone === z.id ? "white" : T.ink,
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                fontFamily: FONT_SANS,
              }}>{z.label}</button>
            ))}
          </div>
          <Label style={{ marginTop: 16 }}>Nivel (1 bien · 5 muy mal)</Label>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setLevel(n)} style={{
                flex: 1, padding: "11px 4px", borderRadius: 10,
                border: `1px solid ${level === n ? T.accentDeep : T.line}`,
                background: level === n
                  ? (n <= 2 ? T.success : n === 3 ? T.gold : T.warn)
                  : T.card,
                color: level === n ? "white" : T.ink,
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: FONT_SANS,
              }}>{n}</button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Nota opcional..."
            style={{ ...inputStyle, textAlign: "left", padding: 12, fontSize: 13, marginTop: 14 }} />
          <Button onClick={handleSave} fullWidth style={{ marginTop: 12 }} disabled={!zone}>Guardar</Button>
        </div>
      )}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PAIN_ZONES.slice(0, 4).map((z) => {
          const avg = getAvgLevel(z.id);
          return (
            <div key={z.id} style={{
              padding: 10, borderRadius: 10, background: T.bgSoft,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 12, color: T.ink }}>{z.label}</span>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: avg === null ? T.inkSoft : avg <= 2 ? T.success : avg <= 3 ? T.gold : T.warn,
              }}>{avg === null ? "—" : `${avg.toFixed(1)}/5`}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ==================== GYM ====================
function PageGym({ coach, registrarSesion, historial, energy, setEnergy, lastPeriod, cycleType }) {
  const [day, setDay] = useState(() => {
    const d = DAY_OF_WEEK();
    return ["lunes", "miercoles", "viernes"].includes(d) ? d : "lunes";
  });
  const data = WORKOUT_DAYS[day];
  const cycleInfo = calcCyclePhase(lastPeriod, 28, cycleType || "regular");

  return (
    <div>
      <EditorialKicker>Entrenamiento · {day}</EditorialKicker>
      <EditorialHero line1="Tu sesión" line2="de hoy."
        subtitle="Tres días de gym con sugerencias inteligentes según tu fase y energía." />

      {cycleInfo && (
        <FadeIn delay={120}>
          <GradientCard gradient={`linear-gradient(135deg, ${cycleInfo.data.color}30 0%, ${cycleInfo.data.color}10 100%)`}
            style={{ marginTop: 22, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 54, height: 54, borderRadius: "50%",
                background: "rgba(255,255,255,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Illustration type={cycleInfo.phase} size={32} color={cycleInfo.data.color} stroke={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600, color: cycleInfo.data.color }}>
                  Fase {cycleInfo.data.name} · día {cycleInfo.dayOfCycle}
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                  {cycleInfo.data.training}
                </p>
              </div>
            </div>
          </GradientCard>
        </FadeIn>
      )}

      <FadeIn delay={200}>
        <SectionHeader roman="I" title="Tu energía ahora" />
        <Card glass>
          <div style={{ display: "flex", gap: 8 }}>
            {["alta", "media", "baja"].map((e) => (
              <button key={e} onClick={() => setEnergy(e)} style={{
                flex: 1, padding: "14px 4px", borderRadius: 14,
                border: `1px solid ${energy === e ? T.accentDeep : T.line}`,
                background: energy === e
                  ? `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`
                  : "rgba(255,255,255,0.5)",
                color: energy === e ? "white" : T.ink,
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: FONT_SANS, textTransform: "capitalize",
                transition: `all ${TX_BOUNCY}`,
              }}>{e}</button>
            ))}
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionHeader roman="II" title="Elige el día" />
        <div style={{ display: "flex", gap: 8 }}>
          {Object.keys(WORKOUT_DAYS).map((d) => (
            <button key={d} onClick={() => setDay(d)} style={{
              flex: 1, padding: "16px 8px", borderRadius: 16,
              border: `1px solid ${day === d ? T.accentDeep : "rgba(234, 221, 210, 0.6)"}`,
              background: day === d
                ? `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`
                : "rgba(255, 255, 255, 0.6)",
              color: day === d ? "white" : T.ink,
              fontSize: 12, fontWeight: 500, textTransform: "capitalize",
              cursor: "pointer", fontFamily: FONT_SANS,
              transition: `all ${TX_SMOOTH}`,
            }}>{d}</button>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={400} key={day}>
        <GradientCard gradient={GRADIENTS.aurora} style={{ marginTop: 16, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ fontSize: 42 }}>{data.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.ink, opacity: 0.7, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                {day} · {data.duration} min
              </div>
              <h2 style={{
                fontFamily: FONT_SERIF, fontSize: 28, margin: "8px 0 0 0",
                color: T.ink, lineHeight: 1.1, fontWeight: 400, letterSpacing: -0.5,
              }}>{data.title}</h2>
              <div style={{ fontStyle: "italic", fontFamily: FONT_SERIF, fontSize: 14, color: T.ink, opacity: 0.75, marginTop: 6 }}>
                {data.subtitle}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 18, paddingTop: 16,
            borderTop: `1px solid rgba(58,43,38,0.1)`,
            fontSize: 12, color: T.ink, lineHeight: 1.6,
          }}>
            <span style={{ color: T.accentDeep, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>
              Foco
            </span>
            <div style={{ marginTop: 4, opacity: 0.85 }}>{data.focus}</div>
          </div>
          {data.densityMode && (
            <div style={{
              marginTop: 14, padding: 12,
              background: "rgba(255,255,255,0.5)",
              borderRadius: 10, fontSize: 12, color: T.ink, lineHeight: 1.5,
            }}>
              <span style={{ color: T.gold, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>
                Modo densidad ·
              </span> descansos cortos, más series.
            </div>
          )}
        </GradientCard>
      </FadeIn>

      <FadeIn delay={500}>
        <SectionHeader roman="III" title={`${data.exercises.length} ejercicios`} />
      </FadeIn>

      {data.exercises.map((ex, i) => (
        <FadeIn key={`${day}-${ex.id}`} delay={550 + i * 40}>
          <ExerciseCard ex={ex} coach={coach}
            historial={historial[ex.id] || []} energy={energy}
            cyclePhase={cycleInfo?.phase}
            exerciseNumber={i + 1}
            onSave={(sets) => registrarSesion(day, ex.id, sets)} />
        </FadeIn>
      ))}
    </div>
  );
}

function ExerciseCard({ ex, coach, historial, energy, onSave, cyclePhase, exerciseNumber }) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(
    Array.from({ length: ex.sets }, () => ({ weight: "", reps: "", rir: "" }))
  );
  const [saved, setSaved] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [coachQ, setCoachQ] = useState("");
  const [coachR, setCoachR] = useState("");

  const suggestion = suggestWeight(ex, historial, energy, cyclePhase);

  const updateSet = (i, field, val) => {
    const updated = [...sets];
    updated[i] = { ...updated[i], [field]: val };
    setSets(updated);
    setSaved(false);
  };

  const handleSave = () => {
    const cleaned = sets.map((s) => ({
      weight: parseFloat(s.weight) || 0,
      reps: parseInt(s.reps) || 0,
      rir: s.rir,
    }));
    onSave(cleaned);
    setSaved(true);
    setShowConfetti(true);
    haptic("success");
    setTimeout(() => setShowConfetti(false), 4000);
    setTimeout(() => setSaved(false), 2500);
  };

  const ask = async () => {
    if (!coachQ.trim()) return;
    const r = await coach.ask(`Ejercicio: ${ex.name}. Pregunta: ${coachQ}`);
    if (r) setCoachR(r);
  };

  const romanNum = exerciseNumber ? ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][exerciseNumber - 1] : null;

  return (
    <>
      <BotanicalConfetti show={showConfetti} />
      <Card glass style={{ marginBottom: 12, padding: open ? 24 : 20 }}>
        <div onClick={() => setOpen(!open)} style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", cursor: "pointer", gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            {romanNum && (
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 28, fontStyle: "italic",
                color: T.accent, lineHeight: 0.9, letterSpacing: -0.5,
                fontWeight: 400, opacity: 0.7,
              }}>{romanNum}</div>
            )}
            <H3 style={{ fontSize: 17, marginTop: romanNum ? 6 : 0 }}>{ex.name}</H3>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Pill>{`${ex.sets} × ${ex.reps}`}</Pill>
              <Pill color={T.gold}>{ex.rir}</Pill>
              <Pill color={T.inkMid}>{ex.rest}</Pill>
            </div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: open ? T.accentDeep : T.bgAlt,
            color: open ? "white" : T.ink,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, transition: `all ${TX_SMOOTH}`,
            transform: open ? "rotate(45deg)" : "rotate(0)", flexShrink: 0,
          }}>+</div>
        </div>

        {open && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.lineSoft}` }}>
            <div style={{
              padding: 18,
              background: suggestion.source === "aprendido"
                ? `linear-gradient(135deg, ${T.success}20 0%, ${T.success}08 100%)`
                : GRADIENTS.lunar,
              borderRadius: 16, marginBottom: 16,
            }}>
              <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Sugerencia de hoy
              </div>
              <div style={{
                fontSize: 42, fontWeight: 400, color: T.ink,
                marginTop: 6, fontFamily: FONT_SERIF, letterSpacing: -1,
                fontStyle: "italic", lineHeight: 1,
              }}>
                {suggestion.suggested} <span style={{ fontSize: 18, color: T.inkMid, fontStyle: "normal" }}>kg</span>
              </div>
              <p style={{ fontSize: 13, color: T.inkMid, margin: "8px 0 0 0", lineHeight: 1.5 }}>
                {suggestion.message}
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Técnica
              </div>
              <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: "8px 0 0 0" }}>{ex.tech}</p>
            </div>

            <div style={{
              fontSize: 13, color: T.ink, lineHeight: 1.55,
              margin: "14px 0 0 0", padding: 14,
              background: `linear-gradient(135deg, ${T.bgAlt} 0%, ${T.bgSoft} 100%)`,
              borderRadius: 12, fontStyle: "italic", fontFamily: FONT_SERIF,
              borderLeft: `3px solid ${T.gold}`,
            }}>"{ex.cue}"</div>

            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Registro de series
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr",
                gap: 8, alignItems: "center", marginTop: 12,
              }}>
                <div style={{ fontSize: 10, color: T.inkSoft }}>#</div>
                <div style={{ fontSize: 10, color: T.inkSoft, textAlign: "center" }}>kg</div>
                <div style={{ fontSize: 10, color: T.inkSoft, textAlign: "center" }}>reps</div>
                <div style={{ fontSize: 10, color: T.inkSoft, textAlign: "center" }}>RIR</div>
                {sets.map((s, i) => (
                  <React.Fragment key={i}>
                    <div style={{ fontSize: 13, color: T.inkMid, fontWeight: 500, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{i + 1}</div>
                    <input type="number" step="0.5" value={s.weight}
                      onChange={(e) => updateSet(i, "weight", e.target.value)}
                      placeholder={String(suggestion.suggested)} style={inputStyle} />
                    <input type="number" value={s.reps}
                      onChange={(e) => updateSet(i, "reps", e.target.value)}
                      placeholder="10" style={inputStyle} />
                    <input type="text" value={s.rir}
                      onChange={(e) => updateSet(i, "rir", e.target.value)}
                      placeholder="2" style={inputStyle} />
                  </React.Fragment>
                ))}
              </div>
              <Button onClick={handleSave} variant={saved ? "ghost" : "primary"}
                fullWidth style={{ marginTop: 16 }}>
                {saved ? "✓ Guardado" : "Guardar sesión"}
              </Button>
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Pregunta al coach
              </div>
              <input value={coachQ} onChange={(e) => setCoachQ(e.target.value)}
                placeholder="Ej: ¿cómo sé si mi forma está bien?"
                style={{ ...inputStyle, textAlign: "left", padding: 12, fontSize: 13, marginTop: 10 }} />
              <Button onClick={ask} variant="soft" disabled={coach.loading} style={{ marginTop: 10 }}>
                {coach.loading ? "Pensando..." : "Consultar"}
              </Button>
              {coachR && (
                <div style={{
                  marginTop: 12, padding: 14, background: GRADIENTS.lunar,
                  borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: "pre-wrap", color: T.ink,
                  fontFamily: FONT_SERIF, fontStyle: "italic",
                }}>{coachR}</div>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ==================== WEATHER ====================
// Hook que obtiene el clima usando Open-Meteo (API gratis, sin key)
function useWeather(lat = -17.783, lon = -63.182) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Open-Meteo — gratis, sin registro, sin API key
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled && data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            humidity: data.current.relative_humidity_2m,
            code: data.current.weather_code,
          });
        }
      } catch (e) {
        // Falla silenciosa — no interrumpir la app
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lon]);

  return weather;
}

// Decodifica WMO weather codes a categoría simple
function decodeWeather(code) {
  if (code === 0) return { label: "Despejado", icon: "☀️", mood: "clear", particles: "sun" };
  if (code <= 3) return { label: "Parcialmente nublado", icon: "⛅", mood: "partly", particles: "sun" };
  if (code <= 48) return { label: "Brumoso", icon: "🌫️", mood: "foggy", particles: "dust" };
  if (code <= 57) return { label: "Llovizna", icon: "🌦️", mood: "drizzle", particles: "rain" };
  if (code <= 67) return { label: "Lluvia", icon: "🌧️", mood: "rainy", particles: "rain" };
  if (code <= 77) return { label: "Nieve", icon: "🌨️", mood: "snowy", particles: "snow" };
  if (code <= 82) return { label: "Chubascos", icon: "🌦️", mood: "showers", particles: "rain" };
  if (code <= 99) return { label: "Tormenta", icon: "⛈️", mood: "storm", particles: "storm" };
  return { label: "", icon: "🌤️", mood: "clear", particles: "none" };
}

// Genera sugerencia contextual según clima + día de la semana
function getWeatherSuggestion(weather, dayOfWeek) {
  if (!weather) return null;
  const { mood } = decodeWeather(weather.code);
  const { temp } = weather;

  if (mood === "rainy" || mood === "storm" || mood === "showers") {
    return dayOfWeek === "lunes" || dayOfWeek === "miercoles" || dayOfWeek === "viernes"
      ? "Día lluvioso. Si salís al gym, lleva cambio de ropa. Si te quedas, hay sesión de Pilates en casa."
      : "Día perfecto para Pilates en casa. Vela prendida, música suave.";
  }
  if (mood === "storm") return "Mejor entrenar en casa hoy. Cuida tu seguridad.";
  if (temp >= 32) return "Calor intenso. Hidrátate antes y durante el entreno. Cuida tu piso pélvico.";
  if (temp >= 28) return "Temperatura alta. Lleva botella grande y sal temprano si puedes.";
  if (temp <= 15) return "Fresco. Abrigo ligero + calentamiento extra antes del gym.";
  if (mood === "clear" && temp >= 20 && temp <= 28) return "Clima ideal. Aprovecha — tu cuerpo agradece.";
  return null;
}

// Partículas ambient según clima
function WeatherParticles({ mood }) {
  if (!mood || mood === "none" || mood === "clear") return null;

  const particles = useMemo(() => {
    let count = 30;
    if (mood === "rain" || mood === "drizzle") count = 50;
    if (mood === "snowy") count = 40;
    if (mood === "storm" || mood === "showers") count = 70;

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: mood === "snow" ? 8 + Math.random() * 6 : 1.2 + Math.random() * 1.8,
      size: mood === "snow" ? 2 + Math.random() * 3 : 1 + Math.random() * 1.5,
    }));
  }, [mood]);

  const isRain = mood === "rainy" || mood === "drizzle" || mood === "showers" || mood === "storm";
  const isSnow = mood === "snowy";

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      overflow: "hidden", zIndex: 0, opacity: 0.4,
    }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.left}%`, top: "-20px",
          width: isRain ? 1 : p.size,
          height: isRain ? 12 + Math.random() * 8 : p.size,
          background: isRain
            ? "linear-gradient(to bottom, transparent, rgba(120, 150, 180, 0.5))"
            : isSnow ? "rgba(255, 255, 255, 0.8)"
            : "rgba(180, 160, 140, 0.4)",
          borderRadius: isRain ? 0 : "50%",
          animation: `weatherFall ${p.duration}s linear ${p.delay}s infinite`,
          filter: isSnow ? "blur(0.5px)" : "none",
        }} />
      ))}
    </div>
  );
}

// Widget de clima compacto para el hero
function WeatherBadge({ weather }) {
  if (!weather) return null;
  const info = decodeWeather(weather.code);

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 999,
      background: "rgba(255, 255, 255, 0.5)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${T.line}`,
      fontSize: 11, color: T.ink,
    }}>
      <span style={{ fontSize: 14 }}>{info.icon}</span>
      <span style={{
        fontFamily: FONT_SERIF, fontSize: 14,
        fontStyle: "italic", letterSpacing: -0.2,
      }}>{weather.temp}°</span>
      <span style={{
        fontSize: 10, color: T.inkSoft, letterSpacing: 1,
        textTransform: "uppercase", fontWeight: 600,
      }}>{info.label}</span>
    </div>
  );
}

// Card editorial con sugerencia del clima
function WeatherCard({ weather, dayOfWeek }) {
  if (!weather) return null;
  const info = decodeWeather(weather.code);
  const suggestion = getWeatherSuggestion(weather, dayOfWeek);
  if (!suggestion) return null;

  return (
    <FadeIn delay={420}>
      <Card glass style={{
        marginTop: 16, padding: 18,
        borderLeft: `3px solid ${T.gold}`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${T.gold}30 0%, ${T.accent}20 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>{info.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, color: T.accentDeep, letterSpacing: 3,
              textTransform: "uppercase", fontWeight: 600,
            }}>Santa Cruz · {weather.temp}°</div>
            <p style={{
              margin: "6px 0 0 0", fontSize: 13, color: T.ink,
              lineHeight: 1.55, fontFamily: FONT_SERIF, fontStyle: "italic",
            }}>{suggestion}</p>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}

// ==================== TU AÑO EN AURA ====================
function YearInReview({ onClose, data }) {
  const [slide, setSlide] = useState(0);
  const {
    userName, year, totalGym, totalNeck, totalPilates,
    totalWeight, biggestLift, topExercise, topSymptom,
    periodsCount, registeredDays, bestMonth,
  } = data;

  const slides = [
    { type: "intro" },
    { type: "stat", kicker: "Entrenamiento", value: totalGym, unit: "sesiones de gym",
      quote: "Cada sesión te construyó.", color: T.accentDeep, bg: GRADIENTS.aurora },
    { type: "stat", kicker: "Peso levantado", value: totalWeight.toLocaleString(), unit: "kg en total",
      quote: totalWeight > 5000 ? "Más que un rinoceronte adulto." : "Tu fuerza acumulada.",
      color: T.gold, bg: GRADIENTS.earth },
    { type: "stat", kicker: "Tu protocolo", value: totalNeck, unit: "días cuidando tu cuello",
      quote: "Tu postura es diferente hoy.", color: T.accent, bg: GRADIENTS.lunar },
    { type: "exercise", kicker: "Tu ejercicio del año", value: topExercise.name,
      subtitle: `${topExercise.count} sesiones · ${topExercise.maxWeight} kg máximo`,
      color: T.accentDeep },
    { type: "cycle", kicker: "Tu ciclo", periodsCount, registeredDays, bestMonth, topSymptom },
    { type: "closing" },
  ];

  const next = () => {
    haptic("light");
    if (slide < slides.length - 1) setSlide(slide + 1);
  };
  const prev = () => {
    haptic("light");
    if (slide > 0) setSlide(slide - 1);
  };

  const currentSlide = slides[slide];

  // Auto-advance en intro y closing
  useEffect(() => {
    if (currentSlide.type === "intro") {
      const t = setTimeout(() => next(), 3500);
      return () => clearTimeout(t);
    }
  }, [slide]);

  const bgStyle = currentSlide.bg || GRADIENTS.aurora;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: isNightTime()
        ? "linear-gradient(180deg, #1A1525 0%, #2D2040 100%)"
        : bgStyle,
      zIndex: 9500,
      display: "flex", flexDirection: "column",
      padding: 24, overflow: "hidden",
      animation: "fadeIn 500ms ease-out",
      transition: "background 600ms ease",
    }}>
      {/* Cerrar */}
      <button onClick={() => { haptic("light"); onClose(); }} style={{
        position: "absolute", top: 24, right: 24, zIndex: 10,
        background: "rgba(255,255,255,0.3)",
        backdropFilter: "blur(10px)",
        border: "none", borderRadius: "50%",
        width: 36, height: 36, color: T.ink, cursor: "pointer",
        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
      }}>×</button>

      {/* Indicador de progreso superior */}
      <div style={{
        position: "absolute", top: 24, left: 24, right: 80,
        display: "flex", gap: 4,
      }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: i <= slide ? T.accentDeep : "rgba(0,0,0,0.1)",
            transition: "background 300ms",
          }} />
        ))}
      </div>

      {/* Partículas ambient */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(15)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 3 + Math.random() * 3, height: 3 + Math.random() * 3,
            borderRadius: "50%",
            background: T.gold, opacity: 0.3 + Math.random() * 0.3,
            filter: "blur(1px)",
            animation: `breathe ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
      </div>

      {/* CONTENIDO */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 1,
      }} key={slide}>
        <div style={{
          maxWidth: 420, width: "100%", textAlign: "center",
          animation: "slideUp 700ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {/* SLIDE: INTRO */}
          {currentSlide.type === "intro" && (
            <div>
              <div style={{
                fontSize: 10, color: T.accentDeep, letterSpacing: 5,
                textTransform: "uppercase", fontWeight: 600, marginBottom: 12,
              }}>Aura · Retrospectiva</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 72, fontWeight: 400,
                color: T.ink, letterSpacing: -2, lineHeight: 0.9,
                fontStyle: "italic",
              }}>Tu año</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 72, fontWeight: 400,
                color: T.ink, letterSpacing: -2, lineHeight: 0.9,
              }}>en <em>Aura</em>.</div>
              <div style={{
                marginTop: 32, fontSize: 12, color: T.inkMid,
                letterSpacing: 6, textTransform: "uppercase", fontWeight: 600,
              }}>{year}</div>
              <div style={{
                marginTop: 40, fontFamily: FONT_SERIF, fontSize: 16,
                fontStyle: "italic", color: T.inkMid, lineHeight: 1.5,
              }}>
                Una retrospectiva para<br/><em>{userName}.</em>
              </div>
            </div>
          )}

          {/* SLIDE: STAT GRANDE */}
          {currentSlide.type === "stat" && (
            <div>
              <div style={{
                fontSize: 10, color: currentSlide.color, letterSpacing: 5,
                textTransform: "uppercase", fontWeight: 600, marginBottom: 20,
              }}>{currentSlide.kicker}</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 120, fontWeight: 400,
                color: T.ink, letterSpacing: -4, lineHeight: 0.9,
                fontStyle: "italic",
              }}>{currentSlide.value}</div>
              <div style={{
                marginTop: 8, fontSize: 14, color: T.inkMid,
                fontFamily: FONT_SANS, letterSpacing: 1,
              }}>{currentSlide.unit}</div>
              <div style={{
                marginTop: 40, padding: 20,
                background: "rgba(255, 255, 255, 0.4)",
                backdropFilter: "blur(20px)",
                borderRadius: 18,
                borderLeft: `3px solid ${currentSlide.color}`,
              }}>
                <p style={{
                  margin: 0, fontFamily: FONT_SERIF, fontSize: 17,
                  color: T.ink, fontStyle: "italic", lineHeight: 1.5,
                }}>"{currentSlide.quote}"</p>
              </div>
            </div>
          )}

          {/* SLIDE: EJERCICIO */}
          {currentSlide.type === "exercise" && (
            <div>
              <div style={{
                fontSize: 10, color: currentSlide.color, letterSpacing: 5,
                textTransform: "uppercase", fontWeight: 600, marginBottom: 20,
              }}>{currentSlide.kicker}</div>
              <div style={{
                fontSize: 48, marginBottom: 24,
              }}>🏆</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 54, fontWeight: 400,
                color: T.ink, letterSpacing: -1.5, lineHeight: 1,
                fontStyle: "italic",
              }}>{currentSlide.value}</div>
              <div style={{
                marginTop: 16, fontSize: 13, color: T.inkMid,
                letterSpacing: 1, fontFamily: FONT_SANS,
              }}>{currentSlide.subtitle}</div>
              <div style={{
                marginTop: 32, padding: 20,
                background: "rgba(255, 255, 255, 0.4)",
                backdropFilter: "blur(20px)",
                borderRadius: 18,
              }}>
                <p style={{
                  margin: 0, fontFamily: FONT_SERIF, fontSize: 15,
                  color: T.ink, fontStyle: "italic", lineHeight: 1.5,
                }}>Tu constancia con este ejercicio<br/>dice mucho de ti.</p>
              </div>
            </div>
          )}

          {/* SLIDE: CICLO */}
          {currentSlide.type === "cycle" && (
            <div>
              <div style={{
                fontSize: 10, color: T.accentDeep, letterSpacing: 5,
                textTransform: "uppercase", fontWeight: 600, marginBottom: 20,
              }}>{currentSlide.kicker}</div>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🌕</div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                marginTop: 24,
              }}>
                <div style={{
                  padding: 18, borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.5)",
                  backdropFilter: "blur(20px)",
                }}>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 36, fontStyle: "italic",
                    color: T.ink, letterSpacing: -1, lineHeight: 1,
                  }}>{currentSlide.periodsCount}</div>
                  <div style={{
                    fontSize: 9, color: T.inkMid, letterSpacing: 2,
                    textTransform: "uppercase", fontWeight: 600, marginTop: 6,
                  }}>períodos</div>
                </div>
                <div style={{
                  padding: 18, borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.5)",
                  backdropFilter: "blur(20px)",
                }}>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 36, fontStyle: "italic",
                    color: T.ink, letterSpacing: -1, lineHeight: 1,
                  }}>{currentSlide.registeredDays}</div>
                  <div style={{
                    fontSize: 9, color: T.inkMid, letterSpacing: 2,
                    textTransform: "uppercase", fontWeight: 600, marginTop: 6,
                  }}>días registrados</div>
                </div>
              </div>
              <div style={{
                marginTop: 24, padding: 20,
                background: "rgba(255, 255, 255, 0.4)",
                backdropFilter: "blur(20px)",
                borderRadius: 18,
                borderLeft: `3px solid ${T.gold}`,
              }}>
                <p style={{
                  margin: 0, fontFamily: FONT_SERIF, fontSize: 15,
                  color: T.ink, fontStyle: "italic", lineHeight: 1.5,
                }}>Conocer tu cuerpo<br/>es un acto de amor propio.</p>
              </div>
            </div>
          )}

          {/* SLIDE: CLOSING */}
          {currentSlide.type === "closing" && (
            <div>
              <div style={{
                fontSize: 10, color: T.accentDeep, letterSpacing: 5,
                textTransform: "uppercase", fontWeight: 600, marginBottom: 20,
              }}>{year} · Terminado</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 56, fontWeight: 400,
                color: T.ink, letterSpacing: -1.5, lineHeight: 1,
              }}>Gracias,</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 56, fontWeight: 400,
                color: T.ink, letterSpacing: -1.5, lineHeight: 1,
                fontStyle: "italic",
              }}>{userName}.</div>
              <div style={{
                marginTop: 32, padding: 24,
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(20px)",
                borderRadius: 20,
                borderTop: `2px solid ${T.gold}`,
              }}>
                <p style={{
                  margin: 0, fontFamily: FONT_SERIF, fontSize: 17,
                  color: T.ink, fontStyle: "italic", lineHeight: 1.55,
                }}>"Cada dato que registraste<br/>fue un acto de cuidado.<br/>Nos vemos el próximo año."</p>
                <div style={{
                  marginTop: 16, fontSize: 10, color: T.inkSoft,
                  letterSpacing: 3, textTransform: "uppercase", fontWeight: 600,
                }}>— Aura</div>
              </div>
              <Button onClick={onClose} fullWidth style={{
                marginTop: 24,
                background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.gold} 100%)`,
                boxShadow: "0 8px 24px rgba(201,169,110,0.4)",
              }}>Cerrar retrospectiva</Button>
            </div>
          )}
        </div>
      </div>

      {/* Controles de navegación */}
      {currentSlide.type !== "intro" && currentSlide.type !== "closing" && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          paddingBottom: 16, position: "relative", zIndex: 1,
        }}>
          <button onClick={prev} disabled={slide === 0} style={{
            background: "rgba(255,255,255,0.4)",
            backdropFilter: "blur(10px)",
            border: "none", borderRadius: 999,
            padding: "12px 20px", color: T.ink, cursor: "pointer",
            fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600,
            letterSpacing: 1, textTransform: "uppercase",
            opacity: slide === 0 ? 0.3 : 1,
          }}>‹ Anterior</button>
          <button onClick={next} style={{
            background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
            border: "none", borderRadius: 999,
            padding: "12px 24px", color: "white", cursor: "pointer",
            fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600,
            letterSpacing: 1, textTransform: "uppercase",
            boxShadow: "0 4px 14px rgba(184,128,111,0.3)",
          }}>Siguiente ›</button>
        </div>
      )}
    </div>
  );
}

// ==================== TRIGGER DE RETROSPECTIVA ====================
function YearReviewTrigger({ historialEj, sesionesGym, sesionesPilates, sesionesCuello,
  cycleHistory, cycleSymptoms, userName, painLog }) {
  const [show, setShow] = useState(false);

  // Calcula datos para la retrospectiva
  const reviewData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `${currentYear}-`;

    const safeGym = Array.isArray(sesionesGym) ? sesionesGym : [];
    const safePilates = Array.isArray(sesionesPilates) ? sesionesPilates : [];
    const safeCuello = Array.isArray(sesionesCuello) ? sesionesCuello : [];
    const safeCycle = Array.isArray(cycleHistory) ? cycleHistory : [];

    const totalGym = safeGym.filter(s => s.date && s.date.startsWith(yearPrefix)).length;
    const pilatesDates = safePilates.map(s => typeof s === "string" ? s : s.date);
    const totalPilates = pilatesDates.filter(d => d && d.startsWith(yearPrefix)).length;
    const totalNeck = safeCuello.filter(d => d && d.startsWith(yearPrefix)).length;

    // Total peso levantado
    let totalWeight = 0;
    const exerciseStats = {};
    Object.entries(historialEj || {}).forEach(([exId, sessions]) => {
      (sessions || []).forEach((session) => {
        if (!session.date || !session.date.startsWith(yearPrefix)) return;
        (session.sets || []).forEach((set) => {
          const reps = parseInt(set.reps) || 0;
          const weight = parseFloat(set.weight) || 0;
          totalWeight += reps * weight;
        });
        if (!exerciseStats[exId]) exerciseStats[exId] = { count: 0, maxWeight: 0 };
        exerciseStats[exId].count++;
        const sessionMax = Math.max(...(session.sets || []).map(s => parseFloat(s.weight) || 0));
        if (sessionMax > exerciseStats[exId].maxWeight) exerciseStats[exId].maxWeight = sessionMax;
      });
    });

    const EXERCISE_NAMES = {
      hip_thrust: "Hip Thrust", bulgaro: "Búlgara", kickback_lun: "Kickback",
      lateral: "Elev. Laterales", pajaros: "Pájaros", face_pulls: "Face Pulls",
      jalon_supino: "Jalón Supino", remo: "Remo Sentado", dead_bug: "Dead Bug",
      plancha: "Plancha", prensa: "Prensa", rumano: "Peso Muerto Rumano",
      hip_unilateral: "Hip Thrust Unilateral", kickback_vie: "Kickback Volumen",
      abductor: "Abductor",
    };

    const topExerciseId = Object.entries(exerciseStats)
      .sort(([,a], [,b]) => b.count - a.count)[0];

    const topExercise = topExerciseId ? {
      name: EXERCISE_NAMES[topExerciseId[0]] || topExerciseId[0],
      count: topExerciseId[1].count,
      maxWeight: topExerciseId[1].maxWeight,
    } : { name: "—", count: 0, maxWeight: 0 };

    const periodsCount = safeCycle.filter(d => d && d.startsWith(yearPrefix)).length;
    const registeredDays = Object.keys(cycleSymptoms || {})
      .filter(d => d.startsWith(yearPrefix)).length;

    return {
      userName: userName || "Fer",
      year: currentYear,
      totalGym, totalNeck, totalPilates,
      totalWeight: Math.round(totalWeight),
      topExercise, periodsCount, registeredDays,
      topSymptom: "", bestMonth: "",
    };
  }, [historialEj, sesionesGym, sesionesPilates, sesionesCuello,
      cycleHistory, cycleSymptoms, userName]);

  const hasEnoughData = reviewData.totalGym + reviewData.totalNeck + reviewData.totalPilates >= 5;

  if (!hasEnoughData) return null;

  return (
    <>
      <FadeIn delay={1200}>
        <Card glass onClick={() => { haptic("medium"); setShow(true); }} style={{
          marginTop: 24, padding: 24, cursor: "pointer",
          background: `linear-gradient(135deg, ${T.gold}20 0%, ${T.accent}15 50%, ${T.accentDeep}10 100%)`,
          border: `1px solid ${T.gold}40`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: `linear-gradient(135deg, ${T.gold} 0%, ${T.accentDeep} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
              boxShadow: `0 4px 20px ${T.gold}40`,
            }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                textTransform: "uppercase", fontWeight: 600,
              }}>Retrospectiva · {reviewData.year}</div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 20, color: T.ink,
                fontStyle: "italic", marginTop: 6, lineHeight: 1.2,
                letterSpacing: -0.3,
              }}>Tu año en Aura</div>
              <div style={{
                fontSize: 11, color: T.inkMid, marginTop: 4,
              }}>Toca para ver la experiencia</div>
            </div>
            <div style={{
              fontSize: 24, color: T.accentDeep, opacity: 0.5,
            }}>›</div>
          </div>
        </Card>
      </FadeIn>

      {show && <YearInReview data={reviewData} onClose={() => setShow(false)} />}
    </>
  );
}

// ==================== ARTE GENERATIVO DEL CICLO ====================
function CycleArtPortrait({ cycleSymptoms = {}, cycleHistory = [], month, year, size = 280 }) {
  // Filtra los datos del mes específico
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthSymptoms = Object.entries(cycleSymptoms || {})
    .filter(([date]) => date.startsWith(monthPrefix));
  const monthPeriods = (cycleHistory || []).filter((d) => d.startsWith(monthPrefix));

  // Extrae métricas del mes para parametrizar el arte
  const metrics = useMemo(() => {
    const daysWithData = monthSymptoms.length;
    const periodDays = monthSymptoms.filter(([_, d]) => d.flow && d.flow !== "none").length;
    const eggWhiteDays = monthSymptoms.filter(([_, d]) => d.mucus === "eggwhite").length;
    const symptomCount = monthSymptoms.reduce((sum, [_, d]) => sum + (d.symptoms || []).length, 0);
    const crampsDays = monthSymptoms.filter(([_, d]) => (d.symptoms || []).includes("cramps")).length;
    const lowEnergyDays = monthSymptoms.filter(([_, d]) => (d.symptoms || []).includes("low_energy")).length;
    const libidoDays = monthSymptoms.filter(([_, d]) => (d.symptoms || []).includes("libido")).length;

    // Calcular "energía dominante" del mes
    const energyScore = libidoDays * 2 - lowEnergyDays;
    const intensity = Math.min(1, (periodDays + symptomCount) / 30);

    return { daysWithData, periodDays, eggWhiteDays, symptomCount, crampsDays, lowEnergyDays, libidoDays, energyScore, intensity };
  }, [monthSymptoms.length, monthPeriods.length]);

  // Si no hay datos, mostrar placeholder elegante
  if (metrics.daysWithData === 0) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size / 2,
        background: `radial-gradient(circle, ${T.bgSoft} 0%, ${T.bgAlt} 100%)`,
        border: `1px dashed ${T.line}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>◌</div>
          <p style={{
            fontSize: 11, color: T.inkSoft, margin: 0, lineHeight: 1.5,
            fontStyle: "italic", fontFamily: FONT_SERIF,
          }}>Tu arte aparece<br/>con tus registros</p>
        </div>
      </div>
    );
  }

  // PARÁMETROS GENERATIVOS
  const seed = (month * 31 + year) % 360;
  const cx = size / 2;
  const cy = size / 2;

  // Color dominante según el mes
  const baseHue = (seed + metrics.periodDays * 12) % 360;
  const colorLayers = [
    `hsl(${baseHue}, 40%, 75%)`,      // accent
    `hsl(${(baseHue + 30) % 360}, 50%, 65%)`,  // deep
    `hsl(${(baseHue + 60) % 360}, 45%, 80%)`,  // gold-ish
  ];

  // Anillos orbitales (uno por día con data)
  const rings = [];
  monthSymptoms.forEach(([date, data], i) => {
    const day = parseInt(date.split("-")[2]);
    const angle = (day / 31) * 360 - 90;
    const rad = (angle * Math.PI) / 180;

    // Radio varía según la intensidad del día
    const intensity = (data.symptoms?.length || 0) + (data.flow && data.flow !== "none" ? 3 : 0);
    const radius = 70 + intensity * 8;

    rings.push({
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
      size: 2 + intensity * 1.2,
      opacity: 0.3 + intensity * 0.1,
      color: data.flow && data.flow !== "none" ? colorLayers[0]
        : data.mucus === "eggwhite" ? "#C9A96E"
        : colorLayers[2],
    });
  });

  // Líneas orgánicas conectando períodos
  const periodPoints = monthPeriods.map((d) => {
    const day = parseInt(d.split("-")[2]);
    const angle = (day / 31) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return { x: cx + 95 * Math.cos(rad), y: cy + 95 * Math.sin(rad) };
  });

  // Pétalos orgánicos según cantidad de síntomas
  const petalCount = Math.min(12, Math.max(3, Math.floor(metrics.symptomCount / 3) + 3));
  const petals = [];
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * 360;
    const rad = (angle * Math.PI) / 180;
    const length = 40 + (metrics.intensity * 40);
    petals.push({
      angle,
      x1: cx + 30 * Math.cos(rad),
      y1: cy + 30 * Math.sin(rad),
      x2: cx + length * Math.cos(rad),
      y2: cy + length * Math.sin(rad),
      opacity: 0.15 + metrics.intensity * 0.2,
    });
  }

  // Núcleo central — representa el mes
  const coreSize = 18 + metrics.periodDays * 1.5;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={`art-core-${month}-${year}`}>
          <stop offset="0%" stopColor={colorLayers[1]} stopOpacity="1" />
          <stop offset="60%" stopColor={colorLayers[0]} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colorLayers[0]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`art-bg-${month}-${year}`}>
          <stop offset="0%" stopColor={colorLayers[0]} stopOpacity="0.15" />
          <stop offset="70%" stopColor={colorLayers[2]} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo de fondo */}
      <circle cx={cx} cy={cy} r={size / 2 - 4} fill={`url(#art-bg-${month}-${year})`} />

      {/* Anillo circular base */}
      <circle cx={cx} cy={cy} r="95" fill="none"
        stroke={colorLayers[2]} strokeWidth="0.5" opacity="0.3" strokeDasharray="2 4" />

      {/* Pétalos radiales */}
      {petals.map((p, i) => (
        <line key={`petal-${i}`}
          x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
          stroke={colorLayers[1]} strokeWidth="1.5"
          opacity={p.opacity} strokeLinecap="round" />
      ))}

      {/* Líneas conectoras entre períodos */}
      {periodPoints.length >= 2 && periodPoints.map((p, i) => {
        if (i === 0) return null;
        const prev = periodPoints[i - 1];
        return (
          <line key={`conn-${i}`}
            x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
            stroke={colorLayers[0]} strokeWidth="1"
            opacity="0.4" strokeDasharray="1 2" />
        );
      })}

      {/* Anillos orbitales — cada día con data */}
      {rings.map((r, i) => (
        <circle key={`ring-${i}`} cx={r.x} cy={r.y} r={r.size}
          fill={r.color} opacity={r.opacity} />
      ))}

      {/* Período points como estrellas */}
      {periodPoints.map((p, i) => (
        <g key={`period-${i}`}>
          <circle cx={p.x} cy={p.y} r="4" fill={colorLayers[0]} opacity="0.9" />
          <circle cx={p.x} cy={p.y} r="8" fill="none"
            stroke={colorLayers[0]} strokeWidth="0.8" opacity="0.4" />
        </g>
      ))}

      {/* Núcleo central */}
      <circle cx={cx} cy={cy} r={coreSize} fill={`url(#art-core-${month}-${year})`} />
      <circle cx={cx} cy={cy} r={coreSize * 0.4} fill={colorLayers[1]} opacity="0.9" />

      {/* Firma — mes y año en caps pequeñas */}
      <text x={cx} y={size - 14} textAnchor="middle"
        fontFamily={FONT_SANS} fontSize="8" fill={T.inkSoft}
        letterSpacing="3" fontWeight="600">
        {["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"][month]} · {year}
      </text>
    </svg>
  );
}

// ==================== GALERÍA DE ARTE ====================
function CycleArtGallery({ cycleSymptoms, cycleHistory }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const prevMonth = () => {
    haptic("light");
    setSelectedMonth((s) => {
      if (s.month === 0) return { year: s.year - 1, month: 11 };
      return { year: s.year, month: s.month - 1 };
    });
  };

  const nextMonth = () => {
    haptic("light");
    setSelectedMonth((s) => {
      if (s.month === 11) return { year: s.year + 1, month: 0 };
      return { year: s.year, month: s.month + 1 };
    });
  };

  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const monthPrefix = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, "0")}`;
  const monthStats = {
    registered: Object.keys(cycleSymptoms || {}).filter(d => d.startsWith(monthPrefix)).length,
    periods: (cycleHistory || []).filter(d => d.startsWith(monthPrefix)).length,
  };

  return (
    <Card glass style={{ padding: 26 }}>
      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={prevMonth} style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `1px solid ${T.line}`, background: T.card,
          color: T.ink, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_SERIF,
        }}>‹</button>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 9, color: T.accentDeep, letterSpacing: 3,
            textTransform: "uppercase", fontWeight: 600,
          }}>Retrato de ciclo</div>
          <div style={{
            fontFamily: FONT_SERIF, fontSize: 22, color: T.ink,
            fontStyle: "italic", letterSpacing: -0.3, marginTop: 4,
          }}>{monthNames[selectedMonth.month]} {selectedMonth.year}</div>
        </div>

        <button onClick={nextMonth} style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `1px solid ${T.line}`, background: T.card,
          color: T.ink, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_SERIF,
        }}>›</button>
      </div>

      {/* Arte generativo */}
      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
        <CycleArtPortrait
          cycleSymptoms={cycleSymptoms}
          cycleHistory={cycleHistory}
          month={selectedMonth.month}
          year={selectedMonth.year}
          size={280} />
      </div>

      {/* Stats + interpretación */}
      {monthStats.registered > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <div style={{
              flex: 1, padding: 12, borderRadius: 12,
              background: `${T.accent}15`, textAlign: "center",
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 20, color: T.accentDeep,
                fontStyle: "italic", fontWeight: 500,
              }}>{monthStats.registered}</div>
              <div style={{
                fontSize: 9, color: T.inkMid, letterSpacing: 1,
                textTransform: "uppercase", fontWeight: 600, marginTop: 2,
              }}>días registrados</div>
            </div>
            <div style={{
              flex: 1, padding: 12, borderRadius: 12,
              background: `${T.gold}15`, textAlign: "center",
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 20, color: T.gold,
                fontStyle: "italic", fontWeight: 500,
              }}>{monthStats.periods}</div>
              <div style={{
                fontSize: 9, color: T.inkMid, letterSpacing: 1,
                textTransform: "uppercase", fontWeight: 600, marginTop: 2,
              }}>períodos</div>
            </div>
          </div>

          <div style={{
            marginTop: 18, padding: 16,
            background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
            borderRadius: 14,
            borderLeft: `3px solid ${T.gold}`,
          }}>
            <p style={{
              margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.6,
              fontStyle: "italic", fontFamily: FONT_SERIF,
            }}>Cada círculo es un día. Cada pétalo, una intensidad. Cada color, tu historia única. Este retrato sólo existe porque vos existes este mes.</p>
          </div>
        </>
      )}
    </Card>
  );
}

// ==================== EXPORTAR REPORTE MÉDICO ====================
function MedicalReport({ cycleSymptoms, cycleHistory, cycleType, cycleStats }) {
  const [exporting, setExporting] = useState(false);

  const generateReport = () => {
    setExporting(true);

    const safeSymptoms = cycleSymptoms || {};
    const safeHistory = (cycleHistory || []).sort();

    // Resumen de síntomas
    const symptomFreq = {};
    const flowDays = [];
    const mucusDays = {};
    Object.entries(safeSymptoms).forEach(([date, day]) => {
      (day.symptoms || []).forEach((s) => {
        symptomFreq[s] = (symptomFreq[s] || 0) + 1;
      });
      if (day.flow && day.flow !== "none") {
        flowDays.push({ date, flow: day.flow });
      }
      if (day.mucus) {
        mucusDays[day.mucus] = (mucusDays[day.mucus] || 0) + 1;
      }
    });

    const symptomLabels = {
      cramps: "Cólicos", bloat: "Hinchazón", breast: "Senos sensibles",
      headache: "Dolor de cabeza", mood: "Irritabilidad", low_energy: "Cansancio",
      libido: "Libido alta", cm_ovul: "Dolor ovárico",
    };

    const flowLabels = {
      spotting: "Manchado", light: "Ligero", medium: "Medio", heavy: "Abundante",
    };

    const mucusLabels = {
      dry: "Seco", sticky: "Pegajoso", creamy: "Cremoso", eggwhite: "Elástico",
    };

    // Calcular duraciones de ciclos
    const cycleDurations = [];
    for (let i = 1; i < safeHistory.length; i++) {
      const d1 = new Date(safeHistory[i - 1] + "T00:00:00");
      const d2 = new Date(safeHistory[i] + "T00:00:00");
      const diff = Math.floor((d2 - d1) / 86400000);
      if (diff > 10 && diff < 120) {
        cycleDurations.push({ from: safeHistory[i - 1], to: safeHistory[i], days: diff });
      }
    }

    const reportDate = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    // HTML del reporte
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de ciclo menstrual — Fer</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', sans-serif;
    color: #3A2B26;
    background: #FDF6F1;
    padding: 48px;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
  }
  .header { border-bottom: 2px solid #B8806F; padding-bottom: 20px; margin-bottom: 36px; }
  .kicker { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #B8806F; font-weight: 600; }
  h1 { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 400; margin-top: 10px; letter-spacing: -0.5px; }
  h1 em { font-style: italic; }
  h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 400; margin: 32px 0 14px; color: #3A2B26; font-style: italic; }
  h3 { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #B8806F; font-weight: 600; margin-bottom: 10px; }
  .meta { color: #7A6A63; font-size: 13px; margin-top: 8px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
  .stat { padding: 14px; background: white; border-radius: 10px; border: 1px solid #EADDD2; }
  .stat-value { font-family: 'Playfair Display', serif; font-size: 24px; font-style: italic; color: #3A2B26; }
  .stat-label { font-size: 10px; color: #9A8A82; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; background: white; border-radius: 10px; overflow: hidden; }
  th { text-align: left; padding: 10px 14px; background: #F7E8DD; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #B8806F; font-weight: 600; }
  td { padding: 10px 14px; border-top: 1px solid #F5EADC; font-size: 13px; }
  .symptom-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
  .symptom { padding: 6px 12px; background: white; border: 1px solid #EADDD2; border-radius: 20px; font-size: 12px; }
  .symptom strong { color: #B8806F; margin-left: 4px; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #EADDD2; font-size: 11px; color: #9A8A82; text-align: center; }
  .note { padding: 16px; background: rgba(194,126,108,0.08); border-left: 3px solid #C27E6C; border-radius: 6px; margin: 14px 0; font-size: 13px; }
  @media print {
    body { padding: 24px; background: white; }
    .stat { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="kicker">Aura · Reporte de ciclo menstrual</div>
    <h1>Historial de <em>Fer</em></h1>
    <div class="meta">Generado el ${reportDate} · Tipo de ciclo: <strong>${cycleType || "no especificado"}</strong></div>
  </div>

  <h2>Resumen</h2>
  <div class="stat-grid">
    <div class="stat">
      <div class="stat-value">${safeHistory.length}</div>
      <div class="stat-label">Períodos</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Object.keys(safeSymptoms).length}</div>
      <div class="stat-label">Días con registro</div>
    </div>
    <div class="stat">
      <div class="stat-value">${cycleStats ? cycleStats.avg + "d" : "—"}</div>
      <div class="stat-label">Promedio</div>
    </div>
    <div class="stat">
      <div class="stat-value">${cycleStats ? "±" + cycleStats.variability + "d" : "—"}</div>
      <div class="stat-label">Variación</div>
    </div>
  </div>

  ${cycleStats && cycleStats.variability > 14 ? `
    <div class="note">
      <strong>Observación:</strong> variación de ${cycleStats.variability} días entre ciclo más corto (${cycleStats.min}d) y más largo (${cycleStats.max}d). Considerada variación alta.
    </div>
  ` : ""}

  <h2>Historial de períodos</h2>
  ${safeHistory.length > 0 ? `
    <table>
      <thead>
        <tr><th>Fecha inicio</th><th>Duración del ciclo</th></tr>
      </thead>
      <tbody>
        ${safeHistory.slice().reverse().map((date, i) => {
          const nextIdx = safeHistory.length - 1 - i;
          const duration = cycleDurations.find(c => c.from === date);
          return `<tr><td>${date}</td><td>${duration ? duration.days + " días" : "—"}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
  ` : "<p style='color:#9A8A82;font-style:italic'>Sin períodos registrados aún.</p>"}

  <h2>Síntomas más frecuentes</h2>
  ${Object.keys(symptomFreq).length > 0 ? `
    <div class="symptom-list">
      ${Object.entries(symptomFreq)
        .sort(([,a], [,b]) => b - a)
        .map(([id, count]) => `
          <div class="symptom">${symptomLabels[id] || id} <strong>${count}×</strong></div>
        `).join("")}
    </div>
  ` : "<p style='color:#9A8A82;font-style:italic'>Sin síntomas registrados aún.</p>"}

  <h2>Días de flujo menstrual</h2>
  <p style="font-size:13px;color:#7A6A63">Total: <strong>${flowDays.length}</strong> días con flujo registrado.</p>
  ${flowDays.length > 0 ? `
    <table>
      <thead>
        <tr><th>Fecha</th><th>Intensidad</th></tr>
      </thead>
      <tbody>
        ${flowDays.slice().reverse().slice(0, 20).map(f =>
          `<tr><td>${f.date}</td><td>${flowLabels[f.flow] || f.flow}</td></tr>`
        ).join("")}
      </tbody>
    </table>
    ${flowDays.length > 20 ? `<p style="font-size:11px;color:#9A8A82;margin-top:8px">Mostrando últimos 20 registros de ${flowDays.length} totales.</p>` : ""}
  ` : ""}

  ${Object.keys(mucusDays).length > 0 ? `
    <h2>Observaciones de moco cervical</h2>
    <div class="symptom-list">
      ${Object.entries(mucusDays).map(([id, count]) => `
        <div class="symptom">${mucusLabels[id] || id} <strong>${count} días</strong></div>
      `).join("")}
    </div>
  ` : ""}

  <div class="footer">
    Reporte generado por Aura — herramienta de seguimiento personal.<br>
    No reemplaza el criterio médico profesional.
  </div>
</body>
</html>`;

    // Abrir en nueva ventana e imprimir
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        win.print();
        setExporting(false);
      }, 600);
    } else {
      alert("Por favor permite ventanas emergentes para generar el reporte.");
      setExporting(false);
    }
  };

  const hasData = (cycleHistory || []).length > 0 || Object.keys(cycleSymptoms || {}).length > 0;

  return (
    <FadeIn delay={800}>
      <SectionHeader roman="VI" title="Reporte para tu médica"
        subtitle="Exporta un resumen editorial de tu historial." />
      <Card glass style={{
        background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.success}30 0%, ${T.gold}20 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 22,
          }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, color: T.accentDeep, letterSpacing: 3,
              textTransform: "uppercase", fontWeight: 600,
            }}>PDF para consulta</div>
            <div style={{
              fontFamily: FONT_SERIF, fontSize: 16, color: T.ink,
              fontStyle: "italic", marginTop: 6, lineHeight: 1.4,
            }}>Resumen editorial de tu ciclo</div>
            <p style={{
              fontSize: 12, color: T.inkMid, margin: "8px 0 14px 0", lineHeight: 1.55,
            }}>
              Incluye estadísticas, historial de períodos, síntomas y observaciones — listo para llevar a tu ginecóloga.
            </p>
            <Button onClick={generateReport} disabled={exporting || !hasData} style={{
              background: `linear-gradient(135deg, ${T.success} 0%, ${T.accentDeep} 100%)`,
              boxShadow: "0 4px 16px rgba(139,168,136,0.25)",
            }}>
              {exporting ? "Generando..." : hasData ? "Generar reporte" : "Sin datos todavía"}
            </Button>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}

// ==================== DETECCIÓN DE FERTILIDAD ====================
function FertilityInsight({ cycleSymptoms, lastPeriod }) {
  const fertile = detectFertileWindow(cycleSymptoms, lastPeriod);
  if (!fertile) return null;

  const confColors = {
    alta: T.gold,
    media: T.accent,
    baja: T.inkMid,
  };
  const color = confColors[fertile.confidence];

  return (
    <FadeIn delay={550}>
      <Card glass style={{
        marginTop: 20,
        background: `linear-gradient(135deg, ${color}20 0%, rgba(255,255,255,0.5) 100%)`,
        border: `1px solid ${color}40`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: `linear-gradient(135deg, ${color} 0%, ${T.gold} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 22,
          }}>🌕</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, color: color, letterSpacing: 3,
              textTransform: "uppercase", fontWeight: 600,
            }}>Ventana fértil · confianza {fertile.confidence}</div>
            <div style={{
              fontFamily: FONT_SERIF, fontSize: 16, color: T.ink,
              fontStyle: "italic", marginTop: 6, lineHeight: 1.4,
            }}>{fertile.signal}</div>
            <p style={{
              fontSize: 12, color: T.inkMid, margin: "8px 0 0 0", lineHeight: 1.5,
            }}>
              Detectado entre <strong style={{ color: T.accentDeep }}>{fertile.fertileStart}</strong>
              {fertile.fertileEnd !== fertile.fertileStart && (
                <> y <strong style={{ color: T.accentDeep }}>{fertile.fertileEnd}</strong></>
              )}.
              {fertile.hasLibido && " También registraste libido alta."}
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}

// ==================== PATRONES DETECTADOS ====================
function PatternInsights({ cycleSymptoms, cycleHistory }) {
  const insights = detectPatterns(cycleSymptoms, cycleHistory);
  if (insights.length === 0) return null;

  return (
    <FadeIn delay={600}>
      <SectionHeader roman="IV" title="Patrones detectados"
        subtitle="Observaciones automáticas de tus últimos 30 días." />
      {insights.map((ins, i) => (
        <Card key={i} glass style={{
          marginBottom: 10,
          borderLeft: `3px solid ${ins.type === "warning" ? T.warn : T.accent}`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              fontSize: 18, lineHeight: 1, marginTop: 2,
            }}>{ins.type === "warning" ? "⚠︎" : "◦"}</div>
            <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
              {ins.text}
            </p>
          </div>
        </Card>
      ))}
    </FadeIn>
  );
}

// ==================== INSIGHTS CON CLAUDE ====================
function ClaudeInsights({ cycleSymptoms, cycleHistory, cycleType, cycleStats }) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const coach = useClaudeCoach();

  const canAsk = Object.keys(cycleSymptoms || {}).length >= 5;

  const requestInsight = async () => {
    setLoading(true);
    // Resumir datos para Claude
    const symptomsCount = Object.keys(cycleSymptoms).length;
    const periodsCount = (cycleHistory || []).length;

    // Top síntomas recurrentes
    const symptomFreq = {};
    Object.values(cycleSymptoms || {}).forEach((day) => {
      (day.symptoms || []).forEach((s) => {
        symptomFreq[s] = (symptomFreq[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([s, n]) => `${s} (${n} veces)`)
      .join(", ");

    const flowDays = Object.values(cycleSymptoms || {})
      .filter(d => d.flow && d.flow !== "none").length;

    const statsText = cycleStats
      ? `Ciclo: más corto ${cycleStats.min}d, más largo ${cycleStats.max}d, promedio ${cycleStats.avg}d, variación ${cycleStats.variability}d.`
      : "Sin suficientes datos estadísticos todavía.";

    const prompt = `Analiza estos datos de ciclo menstrual de Fer (tipo ${cycleType || "regular"}):
- ${periodsCount} períodos registrados
- ${symptomsCount} días de registro de síntomas
- ${flowDays} días con flujo registrado
- ${statsText}
- Síntomas más frecuentes: ${topSymptoms || "ninguno destacado"}

Dame 2-3 observaciones útiles, cálidas y específicas. Sin consejo médico general. Foco en patrones reales. Formato: frases cortas en español, sentence case, sin bullets.`;

    const response = await coach.ask(prompt);
    if (response) setInsight(response);
    setLoading(false);
  };

  return (
    <FadeIn delay={700}>
      <SectionHeader roman="V" title="Insights de tu coach"
        subtitle="Claude analiza tus datos y te da observaciones personalizadas." />

      {!canAsk ? (
        <Card glass style={{
          background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
          textAlign: "center", padding: 24,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>✨</div>
          <p style={{
            margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.5,
            fontStyle: "italic", fontFamily: FONT_SERIF,
          }}>
            Registra al menos 5 días de síntomas para que tu coach pueda analizar patrones.
          </p>
          <p style={{
            margin: "8px 0 0 0", fontSize: 11, color: T.inkMid,
          }}>
            Llevas {Object.keys(cycleSymptoms || {}).length} días registrados.
          </p>
        </Card>
      ) : (
        <Card glass>
          {!insight ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
              <p style={{
                margin: "0 0 16px 0", fontSize: 13, color: T.inkMid, lineHeight: 1.5,
              }}>
                Claude revisará tu historial y te dará observaciones útiles.
              </p>
              <Button onClick={requestInsight} disabled={loading} style={{
                background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.gold} 100%)`,
                boxShadow: "0 4px 16px rgba(201,169,110,0.3)",
              }}>
                {loading ? "Analizando tus datos..." : "Pedir análisis"}
              </Button>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                textTransform: "uppercase", fontWeight: 600,
              }}>Lo que veo en tu historial</div>
              <div style={{
                marginTop: 12, padding: 18,
                background: GRADIENTS.lunar,
                borderRadius: 14, fontSize: 14, color: T.ink,
                lineHeight: 1.65, whiteSpace: "pre-wrap",
                fontFamily: FONT_SERIF, fontStyle: "italic",
                borderLeft: `3px solid ${T.gold}`,
              }}>{insight}</div>
              <Button onClick={requestInsight} variant="ghost" disabled={loading}
                fullWidth style={{ marginTop: 12 }}>
                {loading ? "Analizando..." : "Pedir nuevo análisis"}
              </Button>
            </>
          )}
        </Card>
      )}
    </FadeIn>
  );
}

// ==================== RITUAL DIARIO ====================
function DailyRitual({ onComplete, userName }) {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(null);
  const [intention, setIntention] = useState("");
  const [breathPhase, setBreathPhase] = useState("inhale");
  const [breathCount, setBreathCount] = useState(0);

  const moods = [
    { id: "plena", label: "Plena", icon: "🌸", color: T.accent },
    { id: "normal", label: "Normal", icon: "🌿", color: T.success },
    { id: "cansada", label: "Cansada", icon: "🌙", color: T.gold },
    { id: "apagada", label: "Apagada", icon: "🌧", color: T.inkMid },
  ];

  // Breathing animation (4-7-8)
  useEffect(() => {
    if (step !== 0) return;
    const sequence = [
      { phase: "inhale", duration: 4000 },
      { phase: "hold", duration: 7000 },
      { phase: "exhale", duration: 8000 },
    ];
    let idx = 0;
    let timer;
    const run = () => {
      setBreathPhase(sequence[idx].phase);
      timer = setTimeout(() => {
        idx = (idx + 1) % sequence.length;
        if (idx === 0) setBreathCount((c) => c + 1);
        run();
      }, sequence[idx].duration);
    };
    run();
    return () => clearTimeout(timer);
  }, [step]);

  const next = () => {
    haptic("light");
    setStep(step + 1);
  };

  const finish = () => {
    haptic("success");
    onComplete({ mood, intention: intention.trim(), date: todayStr() });
  };

  const breathText = {
    inhale: "Inhala",
    hold: "Sostén",
    exhale: "Exhala",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: isNightTime()
        ? "linear-gradient(180deg, #1A1525 0%, #241B30 100%)"
        : "linear-gradient(180deg, #FFE0D6 0%, #F9D5C8 100%)",
      zIndex: 8500,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "fadeIn 600ms ease-out",
    }}>
      {/* Skip en esquina */}
      <button onClick={() => onComplete({ skipped: true })} style={{
        position: "absolute", top: 24, right: 24,
        background: "transparent", border: "none",
        color: T.inkSoft, fontSize: 11, letterSpacing: 2,
        textTransform: "uppercase", fontWeight: 600,
        cursor: "pointer", fontFamily: FONT_SANS,
        padding: 8,
      }}>Saltar</button>

      {/* Indicador de progreso */}
      <div style={{
        position: "absolute", top: 50, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", gap: 6,
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: step >= i ? 32 : 12, height: 2,
            borderRadius: 999,
            background: step >= i ? T.accentDeep : T.line,
            transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 420, width: "100%", position: "relative" }}>
        {/* PASO 0: Respiración */}
        {step === 0 && (
          <div style={{ textAlign: "center", animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600,
            }}>Ritual matutino · I</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 44, fontWeight: 400,
              margin: "16px 0 0 0", color: T.ink, letterSpacing: -1,
              fontStyle: "italic",
            }}>Respira.</h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 40px 0",
              lineHeight: 1.5,
            }}>4 segundos inhala · 7 sostén · 8 exhala</p>

            {/* Círculo de respiración */}
            <div style={{
              position: "relative", width: 220, height: 220,
              margin: "0 auto 40px auto",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: `radial-gradient(circle, ${T.accent}40 0%, transparent 70%)`,
                filter: "blur(20px)",
                transform: breathPhase === "inhale" ? "scale(1.3)"
                  : breathPhase === "hold" ? "scale(1.3)"
                  : "scale(0.8)",
                transition: breathPhase === "inhale" ? "transform 4s ease-in-out"
                  : breathPhase === "hold" ? "transform 0s"
                  : "transform 8s ease-in-out",
              }} />
              <div style={{
                width: 160, height: 160, borderRadius: "50%",
                border: `1px solid ${T.accentDeep}`,
                background: `linear-gradient(135deg, ${T.accent}30 0%, ${T.gold}20 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: breathPhase === "inhale" ? "scale(1.2)"
                  : breathPhase === "hold" ? "scale(1.2)"
                  : "scale(0.85)",
                transition: breathPhase === "inhale" ? "transform 4s ease-in-out"
                  : breathPhase === "hold" ? "transform 0s"
                  : "transform 8s ease-in-out",
                boxShadow: `0 0 40px ${T.accent}60`,
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 24,
                    fontStyle: "italic", color: T.ink,
                    letterSpacing: -0.5,
                  }}>{breathText[breathPhase]}</div>
                  <div style={{
                    fontSize: 10, color: T.inkSoft, letterSpacing: 2,
                    textTransform: "uppercase", fontWeight: 600, marginTop: 4,
                  }}>{breathCount + 1} / 3</div>
                </div>
              </div>
            </div>

            <Button onClick={next} fullWidth style={{
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: "0 8px 24px rgba(184,128,111,0.3)",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 1: Mood */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600, textAlign: "center",
            }}>Ritual matutino · II</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 40, fontWeight: 400,
              margin: "16px 0 0 0", color: T.ink, letterSpacing: -1,
              lineHeight: 1.1, textAlign: "center",
            }}>¿Cómo<br/><em>amaneciste?</em></h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 28px 0",
              textAlign: "center",
            }}>Sin filtros. Solo contigo.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {moods.map((m) => (
                <button key={m.id} onClick={() => { haptic("light"); setMood(m.id); }} style={{
                  padding: 20, borderRadius: 18,
                  border: `1px solid ${mood === m.id ? m.color : T.line}`,
                  background: mood === m.id
                    ? `linear-gradient(135deg, ${m.color}25 0%, rgba(255,255,255,0.6) 100%)`
                    : "rgba(255, 255, 255, 0.6)",
                  backdropFilter: "blur(10px)",
                  textAlign: "center", cursor: "pointer",
                  fontFamily: FONT_SANS,
                  transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: mood === m.id ? "scale(1.02)" : "scale(1)",
                  boxShadow: mood === m.id ? `0 8px 24px ${m.color}30` : "none",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 16, color: T.ink,
                    fontStyle: mood === m.id ? "italic" : "normal",
                  }}>{m.label}</div>
                </button>
              ))}
            </div>

            <Button onClick={next} fullWidth disabled={!mood} style={{
              marginTop: 20,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: mood ? "0 8px 24px rgba(184,128,111,0.3)" : "none",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 2: Intención */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600, textAlign: "center",
            }}>Ritual matutino · III</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 40, fontWeight: 400,
              margin: "16px 0 0 0", color: T.ink, letterSpacing: -1,
              lineHeight: 1.1, textAlign: "center",
            }}>Tu intención<br/><em>de hoy.</em></h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 28px 0",
              textAlign: "center",
            }}>Una palabra. La que te guíe.</p>

            <input value={intention} onChange={(e) => setIntention(e.target.value)}
              placeholder="Ej: calma, fuerza, paciencia..."
              autoFocus
              maxLength={20}
              onKeyDown={(e) => e.key === "Enter" && intention.trim() && next()}
              style={{
                width: "100%", padding: 24,
                border: `1px solid ${T.line}`, borderRadius: 18,
                fontSize: 24, fontFamily: FONT_SERIF, color: T.ink,
                background: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(10px)",
                outline: "none", textAlign: "center",
                fontStyle: "italic", boxSizing: "border-box",
              }} />

            <Button onClick={next} fullWidth disabled={!intention.trim()} style={{
              marginTop: 20,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: intention.trim() ? "0 8px 24px rgba(184,128,111,0.3)" : "none",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 3: Cierre */}
        {step === 3 && (
          <div style={{ textAlign: "center", animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600,
            }}>Listo</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 44, fontWeight: 400,
              margin: "20px 0 0 0", color: T.ink, letterSpacing: -1,
              lineHeight: 1.1,
            }}>Hoy, <em>{userName}</em>,<br/>te guía:</h1>
            <div style={{
              margin: "32px 0",
              padding: 32,
              background: "rgba(255, 255, 255, 0.5)",
              backdropFilter: "blur(20px)",
              borderRadius: 24,
              border: `1px solid ${T.gold}40`,
              boxShadow: `0 0 40px ${T.gold}20`,
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 42,
                fontStyle: "italic", color: T.accentDeep,
                letterSpacing: -0.5, textTransform: "lowercase",
              }}>"{intention}"</div>
            </div>
            <Button onClick={finish} fullWidth style={{
              padding: "18px 24px", fontSize: 14, fontWeight: 600,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.gold} 100%)`,
              boxShadow: "0 8px 24px rgba(201,169,110,0.4)",
            }}>Comenzar el día</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== ONBOARDING CEREMONIOSO ====================
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState(null);
  const [cycleType, setCycleType] = useState(null);

  const goals = [
    { id: "composition", label: "Recomposición corporal", icon: "🪶" },
    { id: "strength", label: "Fuerza y glúteos", icon: "🔥" },
    { id: "wellness", label: "Bienestar integral", icon: "🌸" },
    { id: "cycle", label: "Entender mi ciclo", icon: "🌕" },
  ];

  const next = () => {
    haptic("light");
    setStep(step + 1);
  };

  const finish = () => {
    haptic("celebration");
    onComplete({ name: name || "Fer", age, goal, cycleType });
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return goal !== null;
    if (step === 3) return cycleType !== null;
    return true;
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: isNightTime()
        ? "linear-gradient(180deg, #1A1525 0%, #241B30 50%, #1F1A2D 100%)"
        : "linear-gradient(180deg, #FFE0D6 0%, #F9D5C8 30%, #E8C5D0 100%)",
      zIndex: 9000,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "fadeIn 500ms ease-out",
    }}>
      {/* Partículas atmosféricas */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: T.gold, opacity: 0.4,
            filter: "blur(1px)",
            animation: `breathe ${3 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
      </div>

      {/* Indicador de progreso editorial */}
      <div style={{
        position: "absolute", top: 50, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", gap: 6,
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            width: step >= i ? 32 : 12, height: 2,
            borderRadius: 999,
            background: step >= i ? T.accentDeep : T.line,
            transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
        ))}
      </div>

      {/* Número de paso romano */}
      <div style={{
        position: "absolute", top: 90, left: "50%",
        transform: "translateX(-50%)",
        fontSize: 9, color: T.inkSoft, letterSpacing: 4,
        textTransform: "uppercase", fontWeight: 600,
      }}>
        Paso {["I", "II", "III", "IV", "V"][step]} de V
      </div>

      <div style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 1 }} key={step}>
        {/* PASO 0: Logo y bienvenida */}
        {step === 0 && (
          <div style={{ textAlign: "center", animation: "fadeIn 800ms ease-out" }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ marginBottom: 20 }}>
              <circle cx="70" cy="70" r="60"
                fill="none" stroke={T.accentDeep} strokeWidth="1.2"
                strokeDasharray="377" strokeDashoffset="377"
                style={{ animation: "drawStroke 1200ms ease-out forwards" }} />
              <circle cx="70" cy="70" r="42"
                fill="none" stroke={T.accent} strokeWidth="1"
                strokeDasharray="264" strokeDashoffset="264"
                style={{ animation: "drawStroke 1100ms ease-out 300ms forwards" }} />
              <circle cx="70" cy="70" r="12"
                fill={T.gold} opacity="0"
                style={{
                  animation: "logoFade 400ms ease-out 800ms forwards",
                  filter: "drop-shadow(0 0 15px rgba(201,169,110,0.5))",
                }} />
            </svg>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 56, fontWeight: 400,
              margin: 0, color: T.ink, letterSpacing: -1.5,
              fontStyle: "italic",
              animation: "logoFade 800ms ease-out 1000ms both",
            }}>Bienvenida</h1>
            <p style={{
              fontFamily: FONT_SERIF, fontSize: 18, color: T.inkMid,
              fontStyle: "italic", margin: "16px 0 40px 0",
              lineHeight: 1.5,
              animation: "logoFade 800ms ease-out 1300ms both",
            }}>Antes de empezar,<br/>vamos a conocernos.</p>
            <Button onClick={next} fullWidth style={{
              padding: "16px 24px", fontSize: 14, fontWeight: 600,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: "0 8px 24px rgba(184,128,111,0.35)",
              animation: "logoFade 800ms ease-out 1600ms both",
            }}>Comenzar ritual</Button>
          </div>
        )}

        {/* PASO 1: Nombre */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600, textAlign: "center",
            }}>Tu nombre</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 42, fontWeight: 400,
              margin: "14px 0 0 0", color: T.ink, letterSpacing: -1,
              lineHeight: 1.1, textAlign: "center",
            }}>¿Cómo te<br/><em style={{ fontStyle: "italic" }}>llamas?</em></h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 32px 0",
              textAlign: "center", lineHeight: 1.5,
            }}>Tu coach personal necesita saberlo.</p>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && canAdvance() && next()}
              style={{
                width: "100%", padding: 20,
                border: `1px solid ${T.line}`, borderRadius: 16,
                fontSize: 22, fontFamily: FONT_SERIF, color: T.ink,
                background: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(10px)",
                outline: "none", textAlign: "center",
                fontStyle: "italic", boxSizing: "border-box",
              }} />
            <Button onClick={next} fullWidth disabled={!canAdvance()} style={{
              marginTop: 20, padding: "16px 24px",
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: canAdvance() ? "0 8px 24px rgba(184,128,111,0.35)" : "none",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 2: Objetivo */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600, textAlign: "center",
            }}>Tu intención</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 400,
              margin: "14px 0 0 0", color: T.ink, letterSpacing: -0.8,
              lineHeight: 1.1, textAlign: "center",
            }}>¿Qué buscas<br/><em>en Aura?</em></h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 24px 0",
              textAlign: "center",
            }}>Esto personaliza tu experiencia.</p>
            {goals.map((g) => (
              <button key={g.id} onClick={() => { haptic("light"); setGoal(g.id); }} style={{
                width: "100%", padding: 18, marginBottom: 10, borderRadius: 16,
                border: `1px solid ${goal === g.id ? T.accentDeep : T.line}`,
                background: goal === g.id
                  ? `linear-gradient(135deg, ${T.accentDeep}20 0%, rgba(255,255,255,0.6) 100%)`
                  : "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(10px)",
                textAlign: "left", cursor: "pointer",
                fontFamily: FONT_SANS,
                transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: goal === g.id ? "scale(1.02)" : "scale(1)",
                boxShadow: goal === g.id ? `0 8px 24px ${T.accent}30` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 28 }}>{g.icon}</div>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 16, color: T.ink,
                    fontStyle: goal === g.id ? "italic" : "normal",
                  }}>{g.label}</div>
                </div>
              </button>
            ))}
            <Button onClick={next} fullWidth disabled={!canAdvance()} style={{
              marginTop: 14,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: canAdvance() ? "0 8px 24px rgba(184,128,111,0.35)" : "none",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 3: Tipo de ciclo */}
        {step === 3 && (
          <div style={{ animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600, textAlign: "center",
            }}>Tu ciclo</div>
            <h1 style={{
              fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 400,
              margin: "14px 0 0 0", color: T.ink, letterSpacing: -0.8,
              lineHeight: 1.1, textAlign: "center",
            }}>¿Cómo es<br/><em>tu ritmo?</em></h1>
            <p style={{
              fontSize: 13, color: T.inkMid, margin: "16px 0 28px 0",
              textAlign: "center", lineHeight: 1.5,
            }}>Información honesta, no ficticia.</p>

            <button onClick={() => { haptic("light"); setCycleType("regular"); }} style={{
              width: "100%", padding: 20, marginBottom: 10, borderRadius: 16,
              border: `1px solid ${cycleType === "regular" ? T.accentDeep : T.line}`,
              background: cycleType === "regular"
                ? `linear-gradient(135deg, ${T.accent}25 0%, rgba(255,255,255,0.6) 100%)`
                : "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(10px)",
              textAlign: "left", cursor: "pointer",
              fontFamily: FONT_SANS,
              transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              transform: cycleType === "regular" ? "scale(1.02)" : "scale(1)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ fontSize: 28 }}>🌸</div>
                <div>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 18, color: T.ink, fontStyle: "italic" }}>
                    Regular
                  </div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 4, lineHeight: 1.5 }}>
                    Ciclos 26-32 días. Predigo fases.
                  </div>
                </div>
              </div>
            </button>

            <button onClick={() => { haptic("light"); setCycleType("irregular"); }} style={{
              width: "100%", padding: 20, borderRadius: 16,
              border: `1px solid ${cycleType === "irregular" ? T.accentDeep : T.line}`,
              background: cycleType === "irregular"
                ? `linear-gradient(135deg, ${T.accent}25 0%, rgba(255,255,255,0.6) 100%)`
                : "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(10px)",
              textAlign: "left", cursor: "pointer",
              fontFamily: FONT_SANS,
              transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              transform: cycleType === "irregular" ? "scale(1.02)" : "scale(1)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ fontSize: 28 }}>🌊</div>
                <div>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 18, color: T.ink, fontStyle: "italic" }}>
                    Irregular
                  </div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 4, lineHeight: 1.5 }}>
                    Varía mucho. Observo tus síntomas.
                  </div>
                </div>
              </div>
            </button>

            <Button onClick={next} fullWidth disabled={!canAdvance()} style={{
              marginTop: 20,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
              boxShadow: canAdvance() ? "0 8px 24px rgba(184,128,111,0.35)" : "none",
            }}>Continuar</Button>
          </div>
        )}

        {/* PASO 4: Final — bienvenida personalizada */}
        {step === 4 && (
          <div style={{ textAlign: "center", animation: "fadeIn 600ms ease-out" }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 5,
              textTransform: "uppercase", fontWeight: 600,
            }}>Todo listo</div>

            <div style={{
              margin: "28px 0",
              fontFamily: FONT_SERIF, fontSize: 52, fontWeight: 400,
              color: T.ink, letterSpacing: -1.5, lineHeight: 1,
            }}>
              Bienvenida,
              <div style={{ fontStyle: "italic", marginTop: 4 }}>{name || "Fer"}.</div>
            </div>

            <div style={{
              padding: 24, borderRadius: 20,
              background: "rgba(255, 255, 255, 0.5)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${T.line}`,
              marginBottom: 20,
            }}>
              <p style={{
                margin: 0, fontFamily: FONT_SERIF, fontSize: 16,
                color: T.ink, lineHeight: 1.6, fontStyle: "italic",
              }}>
                "Aura es tu espacio. Tu coach personal, tu diario, tu herramienta.
                Cada día que registres, mejor te conozco."
              </p>
              <div style={{
                marginTop: 14, fontSize: 11, color: T.inkSoft,
                letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
              }}>— Tu coach</div>
            </div>

            <Button onClick={finish} fullWidth style={{
              padding: "18px 24px", fontSize: 14, fontWeight: 600,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.gold} 100%)`,
              boxShadow: "0 8px 24px rgba(201,169,110,0.4)",
            }}>Entrar a Aura</Button>
          </div>
        )}
      </div>

      {/* Footer sutil */}
      <div style={{
        position: "absolute", bottom: 24,
        fontSize: 9, color: T.inkSoft, letterSpacing: 3,
        textTransform: "uppercase", fontWeight: 500,
      }}>Aura · Configuración inicial</div>
    </div>
  );
}

// Haptic feedback — vibración sutil en móvil
const haptic = (type = "light") => {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns = {
    light: 8,
    medium: 15,
    heavy: 25,
    success: [10, 30, 10],
    celebration: [10, 40, 10, 40, 20],
  };
  try {
    navigator.vibrate(patterns[type] || patterns.light);
  } catch (e) {}
};

// ==================== CALENDARIO DE CICLO ====================
function CycleCalendar({ cycleHistory = [], cycleSymptoms = {}, cycleType, lastPeriod }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const safeHistory = Array.isArray(cycleHistory) ? cycleHistory : [];
  const safeSymptoms = cycleSymptoms && typeof cycleSymptoms === "object" ? cycleSymptoms : {};

  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const dayNames = ["L", "M", "X", "J", "V", "S", "D"];

  const prevMonth = () => {
    setViewMonth((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewMonth((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  };

  // Calcula días del mes con metadata
  const calendarData = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Días desde el lunes (0 = lunes, 6 = domingo)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    // Generar días previos (del mes anterior) para completar la primera semana
    const prevMonthDays = [];
    if (startOffset > 0) {
      const prevLastDay = new Date(year, month, 0).getDate();
      for (let i = startOffset - 1; i >= 0; i--) {
        prevMonthDays.push({ day: prevLastDay - i, current: false });
      }
    }

    // Días del mes actual
    const currentMonthDays = [];
    const todayStrValue = todayStr();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isPeriodStart = safeHistory.includes(dateStr);
      const symptomData = safeSymptoms[dateStr];
      const hasFlow = symptomData?.flow && symptomData.flow !== "none";
      const hasSymptoms = symptomData?.symptoms?.length > 0 || symptomData?.mucus;
      const isToday = dateStr === todayStrValue;

      currentMonthDays.push({
        day: d,
        dateStr,
        current: true,
        isPeriodStart,
        hasFlow,
        flowLevel: symptomData?.flow,
        hasSymptoms,
        mucus: symptomData?.mucus,
        isToday,
      });
    }

    // Días del mes siguiente para completar la última semana
    const totalCells = prevMonthDays.length + currentMonthDays.length;
    const remainder = totalCells % 7;
    const nextMonthDays = [];
    if (remainder > 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        nextMonthDays.push({ day: i, current: false });
      }
    }

    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [viewMonth, safeHistory, safeSymptoms]);

  // Contador de eventos este mes
  const monthStats = useMemo(() => {
    const { year, month } = viewMonth;
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const periodsThisMonth = safeHistory.filter(d => d.startsWith(monthPrefix)).length;
    const daysRegistered = Object.keys(safeSymptoms).filter(d => d.startsWith(monthPrefix)).length;
    return { periodsThisMonth, daysRegistered };
  }, [viewMonth, safeHistory, safeSymptoms]);

  const FLOW_COLORS = {
    spotting: "#E8B8C4",
    light: "#D88B93",
    medium: "#C27E6C",
    heavy: "#9A3F3F",
  };

  return (
    <Card glass style={{ padding: 20 }}>
      {/* Navegación del mes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <button onClick={prevMonth} style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `1px solid ${T.line}`, background: T.card,
          color: T.ink, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_SERIF,
        }}>‹</button>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: FONT_SERIF, fontSize: 20, color: T.ink,
            fontStyle: "italic", letterSpacing: -0.3,
          }}>{monthNames[viewMonth.month]}</div>
          <div style={{
            fontSize: 10, color: T.inkSoft, letterSpacing: 2,
            textTransform: "uppercase", fontWeight: 600, marginTop: 2,
          }}>{viewMonth.year}</div>
        </div>

        <button onClick={nextMonth} style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `1px solid ${T.line}`, background: T.card,
          color: T.ink, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_SERIF,
        }}>›</button>
      </div>

      {/* Nombres de días */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 4, marginBottom: 6,
      }}>
        {dayNames.map((d, i) => (
          <div key={i} style={{
            textAlign: "center", fontSize: 10, color: T.inkSoft,
            fontWeight: 600, letterSpacing: 1, paddingBottom: 4,
          }}>{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
      }}>
        {calendarData.map((cell, i) => {
          if (!cell.current) {
            return (
              <div key={i} style={{
                aspectRatio: "1", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 11, color: T.inkSoft, opacity: 0.3,
              }}>{cell.day}</div>
            );
          }

          const flowColor = cell.flowLevel && cell.flowLevel !== "none"
            ? FLOW_COLORS[cell.flowLevel] || T.accent
            : null;

          return (
            <div key={i} style={{
              aspectRatio: "1", position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* Círculo de flujo o período */}
              {flowColor && (
                <div style={{
                  position: "absolute", inset: 2, borderRadius: "50%",
                  background: flowColor,
                  boxShadow: `0 2px 6px ${flowColor}60`,
                }} />
              )}

              {/* Círculo dashed si hay síntomas pero no flujo */}
              {!flowColor && cell.hasSymptoms && (
                <div style={{
                  position: "absolute", inset: 3, borderRadius: "50%",
                  border: `1.5px dashed ${T.accentDeep}`,
                  opacity: 0.5,
                }} />
              )}

              {/* Número del día */}
              <span style={{
                position: "relative", zIndex: 1,
                fontSize: 12, fontWeight: cell.isToday ? 700 : 500,
                color: flowColor ? "white"
                  : cell.isToday ? T.accentDeep
                  : T.ink,
                fontFamily: FONT_SANS,
              }}>{cell.day}</span>

              {/* Indicador de hoy */}
              {cell.isToday && !flowColor && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: `2px solid ${T.accentDeep}`,
                }} />
              )}

              {/* Punto de mucus elástico (fértil) */}
              {cell.mucus === "eggwhite" && (
                <div style={{
                  position: "absolute", bottom: 2, right: 2,
                  width: 5, height: 5, borderRadius: "50%",
                  background: T.gold,
                  boxShadow: `0 0 4px ${T.gold}`,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{
        marginTop: 18, paddingTop: 16,
        borderTop: `1px solid ${T.lineSoft}`,
        display: "flex", flexWrap: "wrap", gap: 14,
        fontSize: 10, color: T.inkMid,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.accentDeep }} />
          <span>Período</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            border: `1.5px dashed ${T.accentDeep}`,
          }} />
          <span>Síntomas</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold }} />
          <span>Fértil</span>
        </div>
      </div>

      {/* Stats del mes */}
      {(monthStats.periodsThisMonth > 0 || monthStats.daysRegistered > 0) && (
        <div style={{
          marginTop: 14, display: "flex", gap: 8,
        }}>
          {monthStats.periodsThisMonth > 0 && (
            <div style={{
              flex: 1, padding: 10, borderRadius: 10,
              background: `${T.accent}15`,
              textAlign: "center",
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 18, color: T.accentDeep,
                fontStyle: "italic", fontWeight: 500,
              }}>{monthStats.periodsThisMonth}</div>
              <div style={{
                fontSize: 9, color: T.inkMid, letterSpacing: 1,
                textTransform: "uppercase", fontWeight: 600, marginTop: 2,
              }}>períodos</div>
            </div>
          )}
          {monthStats.daysRegistered > 0 && (
            <div style={{
              flex: 1, padding: 10, borderRadius: 10,
              background: `${T.success}15`,
              textAlign: "center",
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 18, color: T.success,
                fontStyle: "italic", fontWeight: 500,
              }}>{monthStats.daysRegistered}</div>
              <div style={{
                fontSize: 9, color: T.inkMid, letterSpacing: 1,
                textTransform: "uppercase", fontWeight: 600, marginTop: 2,
              }}>días con registro</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ==================== CICLO ====================
const FLOW_LEVELS = [
  { id: "none", label: "Nada", color: T.line },
  { id: "spotting", label: "Manchado", color: "#E8B8C4" },
  { id: "light", label: "Ligero", color: "#D88B93" },
  { id: "medium", label: "Medio", color: "#C27E6C" },
  { id: "heavy", label: "Abundante", color: "#9A3F3F" },
];

const MUCUS_TYPES = [
  { id: "dry", label: "Seco" },
  { id: "sticky", label: "Pegajoso" },
  { id: "creamy", label: "Cremoso" },
  { id: "eggwhite", label: "Elástico" },
];

const CYCLE_SYMPTOMS_LIST = [
  { id: "cramps", label: "Cólicos" },
  { id: "bloat", label: "Hinchazón" },
  { id: "breast", label: "Senos sensibles" },
  { id: "headache", label: "Dolor cabeza" },
  { id: "mood", label: "Irritable" },
  { id: "low_energy", label: "Cansancio" },
  { id: "libido", label: "Libido alta" },
  { id: "cm_ovul", label: "Dolor ovárico" },
];

function PageCycle({ lastPeriod, setLastPeriod, cycleHistory = [], setCycleHistory,
  cycleType, setCycleType, cycleSymptoms = {}, setCycleSymptoms }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showSymptoms, setShowSymptoms] = useState(false);

  const safeHistory = Array.isArray(cycleHistory) ? cycleHistory : [];
  const safeSymptoms = cycleSymptoms && typeof cycleSymptoms === "object" ? cycleSymptoms : {};
  const current = calcCyclePhase(lastPeriod, 28, cycleType || "regular");

  // Estadísticas reales del historial
  const cycleStats = useMemo(() => {
    if (safeHistory.length < 2) return null;
    const sorted = [...safeHistory].sort();
    const diffs = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1] + "T00:00:00");
      const d2 = new Date(sorted[i] + "T00:00:00");
      const diff = Math.floor((d2 - d1) / 86400000);
      if (diff > 10 && diff < 90) diffs.push(diff); // filtra outliers
    }
    if (diffs.length === 0) return null;
    const min = Math.min(...diffs);
    const max = Math.max(...diffs);
    const avg = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    const variability = max - min;
    return { min, max, avg, variability, count: safeHistory.length };
  }, [safeHistory]);

  const handleNewPeriod = () => {
    if (!selectedDate) return;
    setLastPeriod(selectedDate);
    if (!safeHistory.includes(selectedDate)) {
      setCycleHistory([...safeHistory, selectedDate]);
    }
    setShowConfirm(false);
  };

  const openModal = () => {
    setSelectedDate(todayStr());
    setShowConfirm(true);
  };

  const renderDateLabel = () => {
    try {
      const d = new Date(selectedDate + "T00:00:00");
      if (isNaN(d.getTime())) return "Selecciona una fecha";
      return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    } catch (e) {
      return "Selecciona una fecha";
    }
  };

  const todaySymptom = safeSymptoms[todayStr()] || {};

  const updateTodaySymptom = (key, value) => {
    const today = todayStr();
    const updated = { ...safeSymptoms };
    if (!updated[today]) updated[today] = {};
    updated[today] = { ...updated[today], [key]: value };
    setCycleSymptoms(updated);
  };

  const toggleSymptom = (symId) => {
    const today = todayStr();
    const updated = { ...safeSymptoms };
    if (!updated[today]) updated[today] = {};
    const current = updated[today].symptoms || [];
    updated[today].symptoms = current.includes(symId)
      ? current.filter(s => s !== symId)
      : [...current, symId];
    setCycleSymptoms(updated);
  };

  // ONBOARDING: si nunca se configuró tipo
  if (!cycleType) {
    return (
      <div>
        <EditorialKicker>Configuración inicial</EditorialKicker>
        <EditorialHero line1="Cuéntame" line2="sobre tu ciclo."
          subtitle="Esto me ayuda a darte información honesta, no ficticia." />

        <FadeIn delay={150}>
          <Card glass style={{ marginTop: 22, padding: 26 }}>
            <div style={{
              fontSize: 10, color: T.accentDeep, letterSpacing: 3,
              textTransform: "uppercase", fontWeight: 600, marginBottom: 14,
            }}>¿Cómo es tu ciclo?</div>

            <button onClick={() => setCycleType("regular")} style={{
              width: "100%", padding: 20, marginBottom: 12, borderRadius: 18,
              border: `1px solid ${T.line}`, background: T.card,
              textAlign: "left", cursor: "pointer", fontFamily: FONT_SANS,
              transition: `all ${TX_SMOOTH}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 32 }}>🌸</div>
                <div>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 18, color: T.ink, fontStyle: "italic" }}>
                    Regular
                  </div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 4, lineHeight: 1.5 }}>
                    Ciclos de 26-32 días con poca variación. Puedo predecir tus fases.
                  </div>
                </div>
              </div>
            </button>

            <button onClick={() => setCycleType("irregular")} style={{
              width: "100%", padding: 20, borderRadius: 18,
              border: `1px solid ${T.line}`, background: T.card,
              textAlign: "left", cursor: "pointer", fontFamily: FONT_SANS,
              transition: `all ${TX_SMOOTH}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 32 }}>🌊</div>
                <div>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 18, color: T.ink, fontStyle: "italic" }}>
                    Irregular
                  </div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 4, lineHeight: 1.5 }}>
                    Varía mucho, a veces no llega, duración impredecible. Observo tus síntomas en vez de predecir.
                  </div>
                </div>
              </div>
            </button>
          </Card>
        </FadeIn>

        <FadeIn delay={300}>
          <Card glass style={{
            marginTop: 14,
            background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
          }}>
            <p style={{
              margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.55,
              fontStyle: "italic", fontFamily: FONT_SERIF,
            }}>"Los ciclos irregulares son reales y comunes. No son un error — son información. Tu cuerpo tiene su propio ritmo."</p>
          </Card>
        </FadeIn>
      </div>
    );
  }

  const isIrregular = cycleType === "irregular";

  return (
    <div>
      <EditorialKicker>Ciclo {isIrregular ? "irregular" : "regular"} · Tu ritmo</EditorialKicker>
      <EditorialHero
        line1={isIrregular ? "Tu cuerpo," : "Tu ciclo,"}
        line2={isIrregular ? "su ritmo." : "tu superpoder."}
        subtitle={isIrregular
          ? "Observamos en vez de predecir. Cada registro te da más claridad."
          : "Tu entrenamiento se adapta a cada fase."} />

      <Ornament variant="star" spacing={20} />

      {!current ? (
        <FadeIn delay={150}>
          <GradientCard gradient={GRADIENTS.lunar} style={{ marginTop: 22, padding: 32, textAlign: "center" }}>
            <MoonPhase phase="folicular" size={48} />
            <h2 style={{
              fontFamily: FONT_SERIF, fontSize: 28, margin: "16px 0 0 0",
              color: T.ink, lineHeight: 1.1, fontWeight: 400,
              fontStyle: "italic", letterSpacing: -0.5,
            }}>Registra tu último período</h2>
            <p style={{ fontSize: 14, color: T.ink, opacity: 0.8, margin: "12px 0 20px 0", lineHeight: 1.6 }}>
              Con o sin fecha exacta — lo que recuerdes está bien.
            </p>
            <Button onClick={openModal} fullWidth style={{
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
            }}>🩸 Registrar período</Button>
          </GradientCard>
        </FadeIn>
      ) : (
        <>
          {/* HERO — diferente para irregular */}
          <FadeIn delay={150}>
            <GradientCard
              gradient={isIrregular && current.uncertain
                ? `linear-gradient(135deg, ${T.inkSoft}30 0%, ${T.bgAlt} 100%)`
                : `linear-gradient(135deg, ${current.data.color}40 0%, ${current.data.color}15 100%)`}
              style={{ marginTop: 22, padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                    {current.uncertain ? "Día" : "Fase actual"}
                  </div>
                  {current.uncertain ? (
                    <>
                      <div style={{
                        fontFamily: FONT_SERIF, fontSize: 72, lineHeight: 0.9,
                        color: T.ink, marginTop: 12, letterSpacing: -2.5,
                        fontWeight: 400, fontStyle: "italic",
                      }}>{current.dayOfCycle}</div>
                      <div style={{
                        fontSize: 11, color: T.ink, opacity: 0.6,
                        letterSpacing: 2, textTransform: "uppercase", marginTop: 8, fontWeight: 500,
                      }}>desde tu último período</div>
                    </>
                  ) : (
                    <>
                      <h2 style={{
                        fontFamily: FONT_SERIF, fontSize: 36, margin: "10px 0 0 0",
                        color: current.data.color, lineHeight: 1, fontWeight: 400,
                        letterSpacing: -1, fontStyle: "italic",
                      }}>{current.data.name}</h2>
                      <div style={{
                        fontSize: 11, color: T.ink, opacity: 0.6,
                        letterSpacing: 2, textTransform: "uppercase", marginTop: 8, fontWeight: 500,
                      }}>Día {current.dayOfCycle}</div>
                    </>
                  )}
                </div>
                <MoonPhase phase={current.phase === "unknown" ? "folicular" : current.phase} size={44} />
              </div>

              {current.uncertain && (
                <div style={{
                  marginTop: 20, padding: 14,
                  background: "rgba(255,255,255,0.5)",
                  borderRadius: 12, fontSize: 12, color: T.ink, lineHeight: 1.6,
                  fontStyle: "italic", fontFamily: FONT_SERIF,
                }}>Tu ciclo es único. En vez de asumir una fase, registra tus síntomas y energía — así aprendemos juntas tu patrón real.</div>
              )}
            </GradientCard>
          </FadeIn>

          {/* REGISTRO DIARIO DE SÍNTOMAS — CRÍTICO PARA IRREGULAR */}
          <FadeIn delay={300}>
            <SectionHeader roman="I" title="Registro de hoy" subtitle="30 segundos. Cada día cuenta." />
            <Card glass>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{
                  fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                  textTransform: "uppercase", fontWeight: 600,
                }}>Flujo menstrual hoy</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {FLOW_LEVELS.map((f) => {
                  const isSelected = todaySymptom.flow === f.id;
                  return (
                    <button key={f.id} onClick={() => updateTodaySymptom("flow", f.id)} style={{
                      flex: 1, padding: "12px 4px", borderRadius: 12,
                      border: `1px solid ${isSelected ? f.color : T.line}`,
                      background: isSelected ? f.color : T.card,
                      color: isSelected ? "white" : T.ink,
                      fontSize: 11, fontWeight: 500, cursor: "pointer",
                      fontFamily: FONT_SANS,
                      transition: `all ${TX_SMOOTH}`,
                    }}>{f.label}</button>
                  );
                })}
              </div>

              <div style={{
                fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                textTransform: "uppercase", fontWeight: 600, marginTop: 20,
              }}>Moco cervical</div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {MUCUS_TYPES.map((m) => {
                  const isSelected = todaySymptom.mucus === m.id;
                  return (
                    <button key={m.id} onClick={() => updateTodaySymptom("mucus", m.id)} style={{
                      flex: 1, padding: "12px 4px", borderRadius: 12,
                      border: `1px solid ${isSelected ? T.accentDeep : T.line}`,
                      background: isSelected
                        ? `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`
                        : T.card,
                      color: isSelected ? "white" : T.ink,
                      fontSize: 11, fontWeight: 500, cursor: "pointer",
                      fontFamily: FONT_SANS,
                      transition: `all ${TX_SMOOTH}`,
                    }}>{m.label}</button>
                  );
                })}
              </div>
              {todaySymptom.mucus === "eggwhite" && (
                <div style={{
                  marginTop: 12, padding: 12,
                  background: `${T.gold}18`,
                  borderRadius: 10, fontSize: 12, color: T.ink, lineHeight: 1.5,
                  fontStyle: "italic", fontFamily: FONT_SERIF,
                }}>🌕 Moco elástico = posible ventana fértil. Si buscas/evitas embarazo, toma nota.</div>
              )}

              <div style={{
                fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                textTransform: "uppercase", fontWeight: 600, marginTop: 20,
              }}>Síntomas hoy</div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {CYCLE_SYMPTOMS_LIST.map((s) => {
                  const isSelected = (todaySymptom.symptoms || []).includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSymptom(s.id)} style={{
                      padding: "8px 14px", borderRadius: 999,
                      border: `1px solid ${isSelected ? T.accentDeep : T.line}`,
                      background: isSelected ? T.accentDeep : T.card,
                      color: isSelected ? "white" : T.ink,
                      fontSize: 11, fontWeight: 500, cursor: "pointer",
                      fontFamily: FONT_SANS,
                      transition: `all ${TX_FAST}`,
                    }}>{s.label}</button>
                  );
                })}
              </div>
            </Card>
          </FadeIn>

          {/* ESTADÍSTICAS REALES */}
          {cycleStats && (
            <FadeIn delay={450}>
              <SectionHeader roman="II" title="Tu patrón real"
                subtitle={`Basado en ${cycleStats.count} períodos registrados.`} />
              <Card glass style={{ padding: 22 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                      Más corto
                    </div>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 28, color: T.ink, marginTop: 4, fontStyle: "italic", letterSpacing: -0.5 }}>
                      {cycleStats.min}<span style={{ fontSize: 12, color: T.inkMid, fontStyle: "normal", marginLeft: 3 }}>días</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                      Más largo
                    </div>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 28, color: T.ink, marginTop: 4, fontStyle: "italic", letterSpacing: -0.5 }}>
                      {cycleStats.max}<span style={{ fontSize: 12, color: T.inkMid, fontStyle: "normal", marginLeft: 3 }}>días</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                      Promedio
                    </div>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 28, color: T.ink, marginTop: 4, fontStyle: "italic", letterSpacing: -0.5 }}>
                      {cycleStats.avg}<span style={{ fontSize: 12, color: T.inkMid, fontStyle: "normal", marginLeft: 3 }}>días</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                      Variación
                    </div>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 28, color: T.ink, marginTop: 4, fontStyle: "italic", letterSpacing: -0.5 }}>
                      ±{cycleStats.variability}<span style={{ fontSize: 12, color: T.inkMid, fontStyle: "normal", marginLeft: 3 }}>d</span>
                    </div>
                  </div>
                </div>

                {cycleStats.variability > 14 && (
                  <div style={{
                    marginTop: 18, padding: 14,
                    background: `${T.warn}12`,
                    borderRadius: 12, fontSize: 12, color: T.ink, lineHeight: 1.5,
                    fontStyle: "italic", fontFamily: FONT_SERIF,
                  }}>Tu variación es {cycleStats.variability} días. Si aún no lo hablaste con ginecóloga, podría valer la pena para descartar SOP, tiroides o estrés crónico.</div>
                )}
              </Card>
            </FadeIn>
          )}

          {/* CALENDARIO VISUAL */}
          <FadeIn delay={500}>
            <SectionHeader roman={cycleStats ? "III" : "II"} title="Tu calendario"
              subtitle="Desliza entre meses. Cada círculo es tu historia." />
            <CycleCalendar
              cycleHistory={safeHistory}
              cycleSymptoms={safeSymptoms}
              cycleType={cycleType}
              lastPeriod={lastPeriod} />
          </FadeIn>

          {/* DETECCIÓN Y PATRONES */}
          <FertilityInsight cycleSymptoms={safeSymptoms} lastPeriod={lastPeriod} />
          <PatternInsights cycleSymptoms={safeSymptoms} cycleHistory={safeHistory} />

          {/* INSIGHTS CON CLAUDE */}
          <ClaudeInsights cycleSymptoms={safeSymptoms} cycleHistory={safeHistory}
            cycleType={cycleType} cycleStats={cycleStats} />

          {/* ARTE GENERATIVO DEL CICLO */}
          <FadeIn delay={750}>
            <SectionHeader roman="VI" title="Retrato de tu ciclo"
              subtitle="Arte generativo único. Cada mes, una pieza." />
            <CycleArtGallery cycleSymptoms={safeSymptoms} cycleHistory={safeHistory} />
          </FadeIn>

          {/* REPORTE MÉDICO */}
          <MedicalReport cycleSymptoms={safeSymptoms} cycleHistory={safeHistory}
            cycleType={cycleType} cycleStats={cycleStats} />

          {/* RECOMENDACIONES */}
          <FadeIn delay={650}>
            <SectionHeader roman={cycleStats ? "IV" : "III"} title="Cómo cuidarte hoy" />
            <Card glass style={{ marginBottom: 10, borderLeft: `3px solid ${current.data.color}` }}>
              <div style={{ fontSize: 9, color: current.data.color, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Entrenamiento
              </div>
              <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: "8px 0 0 0" }}>
                {current.data.training}
              </p>
            </Card>
            <Card glass style={{ marginBottom: 10, borderLeft: `3px solid ${T.success}` }}>
              <div style={{ fontSize: 9, color: T.success, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Nutrición
              </div>
              <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: "8px 0 0 0" }}>
                {current.data.nutrition}
              </p>
            </Card>
            <Card glass style={{
              marginBottom: 10,
              background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
            }}>
              <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Emoción
              </div>
              <p style={{
                fontSize: 15, color: T.ink, lineHeight: 1.5, margin: "10px 0 0 0",
                fontStyle: "italic", fontFamily: FONT_SERIF,
              }}>"{current.data.mood}"</p>
            </Card>
          </FadeIn>

          <FadeIn delay={800}>
            <Button onClick={openModal} variant="soft" fullWidth style={{
              marginTop: 18,
              background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDeep} 100%)`,
            }}>🩸 Registrar nuevo período</Button>
          </FadeIn>
        </>
      )}

      {/* CAMBIAR TIPO DE CICLO */}
      <FadeIn delay={900}>
        <Card style={{
          marginTop: 28,
          background: T.bgSoft, border: `1px dashed ${T.line}`,
          textAlign: "center", padding: 16,
        }}>
          <p style={{ fontSize: 11, color: T.inkMid, margin: 0, lineHeight: 1.5 }}>
            Tu ciclo está marcado como <strong style={{ color: T.accentDeep }}>{isIrregular ? "irregular" : "regular"}</strong>
          </p>
          <button onClick={() => setCycleType(null)} style={{
            marginTop: 8, background: "transparent", border: "none",
            color: T.accentDeep, fontSize: 11, cursor: "pointer",
            textDecoration: "underline", fontFamily: FONT_SANS,
          }}>Cambiar configuración</button>
        </Card>
      </FadeIn>

      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(58, 43, 38, 0.4)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 16,
          animation: "fadeIn 200ms ease-out",
        }} onClick={() => setShowConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: T.card, borderRadius: 24, padding: 32,
            maxWidth: 400, width: "100%", textAlign: "center",
            boxShadow: SHADOW_ELEV,
          }}>
            <MoonPhase phase="menstrual" size={42} />
            <h2 style={{
              fontFamily: FONT_SERIF, fontSize: 26, margin: "12px 0 0 0",
              color: T.ink, fontStyle: "italic", letterSpacing: -0.5,
            }}>¿Cuándo te bajó?</h2>
            <p style={{ color: T.inkMid, fontSize: 13, margin: "10px 0 20px 0", lineHeight: 1.5 }}>
              Elige el día que comenzó tu período.
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Hoy", offset: 0 },
                { label: "Ayer", offset: 1 },
                { label: "Antier", offset: 2 },
              ].map((opt) => {
                const d = new Date();
                d.setDate(d.getDate() - opt.offset);
                const dStr = d.toISOString().slice(0, 10);
                const isSelected = selectedDate === dStr;
                return (
                  <button key={opt.label} onClick={() => setSelectedDate(dStr)} style={{
                    flex: 1, padding: "12px 4px", borderRadius: 12,
                    border: `1px solid ${isSelected ? T.accentDeep : T.line}`,
                    background: isSelected
                      ? `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`
                      : T.card,
                    color: isSelected ? "white" : T.ink,
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT_SANS,
                  }}>{opt.label}</button>
                );
              })}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 9, color: T.accentDeep, letterSpacing: 3,
                textTransform: "uppercase", fontWeight: 600,
                textAlign: "left", marginBottom: 8,
              }}>O elige otra fecha</div>
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: "100%", padding: 14,
                  border: `1px solid ${T.line}`, borderRadius: 12,
                  fontSize: 15, fontFamily: FONT_SANS, color: T.ink,
                  background: T.bgSoft, outline: "none",
                  textAlign: "center", boxSizing: "border-box",
                }} />
            </div>

            <div style={{
              padding: 14, marginBottom: 18,
              background: `linear-gradient(135deg, ${T.bgAlt} 0%, ${T.bgSoft} 100%)`,
              borderRadius: 12, fontSize: 13, color: T.ink,
              fontFamily: FONT_SERIF, fontStyle: "italic",
            }}>
              Tu período empezó el{" "}
              <strong style={{ color: T.accentDeep, fontWeight: 600, fontStyle: "normal" }}>
                {renderDateLabel()}
              </strong>
            </div>

            <Button onClick={handleNewPeriod} fullWidth style={{
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
            }}>Confirmar</Button>
            <Button onClick={() => setShowConfirm(false)} variant="ghost"
              fullWidth style={{ marginTop: 10 }}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== CUERPO ====================
function PageBody({ bodyMetrics = {}, setBodyMetrics }) {
  const [showAdd, setShowAdd] = useState(null);
  const [value, setValue] = useState("");

  const safeMetrics = bodyMetrics && typeof bodyMetrics === "object" ? bodyMetrics : {};

  const handleSave = (metricId) => {
    if (!value) return;
    const newEntry = { date: todayStr(), value: parseFloat(value) };
    const updated = { ...safeMetrics };
    if (!updated[metricId]) updated[metricId] = [];
    updated[metricId] = [...updated[metricId], newEntry];
    setBodyMetrics(updated);
    setValue("");
    setShowAdd(null);
  };

  const getLatest = (id) => {
    const arr = safeMetrics[id] || [];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  };

  const getTrend = (id) => {
    const arr = safeMetrics[id] || [];
    if (arr.length < 2) return null;
    const first = arr[0].value;
    const last = arr[arr.length - 1].value;
    return { diff: last - first, pct: ((last - first) / first) * 100 };
  };

  const weightLatest = getLatest("weight");

  return (
    <div>
      <EditorialKicker>Composición · Seguimiento</EditorialKicker>
      <EditorialHero line1="Tu cuerpo," line2="tu tiempo."
        subtitle="El número es información. Tu progreso es más que eso." />

      <Ornament variant="leaf" spacing={20} />

      {weightLatest && (
        <FadeIn delay={150}>
          <GradientCard gradient={GRADIENTS.earth} style={{ marginTop: 22, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                  Peso actual
                </div>
                <div style={{
                  fontFamily: FONT_SERIF, fontSize: 72, lineHeight: 0.9,
                  color: T.ink, marginTop: 12, letterSpacing: -2.5,
                  fontWeight: 400, fontStyle: "italic",
                }}>
                  {weightLatest.value}
                  <span style={{ fontSize: 22, fontStyle: "normal", opacity: 0.6, marginLeft: 6 }}>kg</span>
                </div>
              </div>
              <Illustration type="body" size={50} color={T.ink} stroke={1.4} />
            </div>
          </GradientCard>
        </FadeIn>
      )}

      <FadeIn delay={200}>
        <Card glass style={{
          marginTop: 16,
          background: `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.5) 100%)`,
        }}>
          <p style={{
            margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.6,
            fontStyle: "italic", fontFamily: FONT_SERIF,
          }}>"Registro sin juicio. El peso varía por hidratación, ciclo, sueño. Mira la tendencia, no el día."</p>
        </Card>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionHeader roman="I" title="Métricas" />
      </FadeIn>

      {BODY_METRICS.map((m, i) => {
        const latest = getLatest(m.id);
        const trend = getTrend(m.id);
        const romanNum = ["I", "II", "III", "IV"][i];
        return (
          <FadeIn key={m.id} delay={350 + i * 60}>
            <Card glass style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div style={{
                      fontFamily: FONT_SERIF, fontSize: 22, fontStyle: "italic",
                      color: T.accent, lineHeight: 0.9, opacity: 0.7,
                    }}>{romanNum}</div>
                    <H3 style={{ fontSize: 17 }}>{m.label}</H3>
                    <Pill color={T.inkMid} style={{ fontSize: 9 }}>{m.freq}</Pill>
                  </div>
                  {latest ? (
                    <div style={{
                      fontFamily: FONT_SERIF, fontSize: 36, color: T.ink,
                      marginTop: 10, letterSpacing: -1, fontStyle: "italic", lineHeight: 1,
                    }}>
                      {latest.value}
                      <span style={{ fontSize: 14, color: T.inkMid, marginLeft: 4, fontStyle: "normal" }}>{m.unit}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 10, fontStyle: "italic" }}>Sin registros aún</div>
                  )}
                  {trend && (
                    <Pill color={trend.diff < 0 ? T.success : trend.diff > 0 ? T.warn : T.inkSoft}
                      style={{ marginTop: 10 }}>
                      {trend.diff > 0 ? "+" : ""}{trend.diff.toFixed(1)} {m.unit}
                    </Pill>
                  )}
                </div>
                <Button onClick={() => { setShowAdd(showAdd === m.id ? null : m.id); setValue(""); }} variant="subtle">
                  {showAdd === m.id ? "Cerrar" : "+ Registrar"}
                </Button>
              </div>
              {showAdd === m.id && (
                <div style={{
                  marginTop: 16, paddingTop: 16,
                  borderTop: `1px solid ${T.lineSoft}`,
                  display: "flex", gap: 8,
                }}>
                  <input type="number" step="0.1" value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={`Valor en ${m.unit}`}
                    style={{ ...inputStyle, flex: 1, textAlign: "left", padding: 12, fontSize: 14 }}
                    autoFocus />
                  <Button onClick={() => handleSave(m.id)}>Guardar</Button>
                </div>
              )}
            </Card>
          </FadeIn>
        );
      })}

      {/* Cierre editorial reflexivo */}
      <Ornament variant="leaf" spacing={36} />
      <FadeIn delay={300}>
        <div style={{ padding: "8px 20px 32px", maxWidth: 540, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 17,
              lineHeight: 1.7,
              color: T.inkMid,
              fontStyle: "italic",
              textAlign: "justify",
              hyphens: "auto",
              WebkitHyphens: "auto",
              margin: 0,
              fontFeatureSettings: '"liga" 1, "calt" 1, "onum" 1',
              fontVariantNumeric: "oldstyle-nums",
            }}
          >
            <DropCap letter="E" variant="gold" size={72} />
            l cuerpo no es el número en la balanza. El número
            es uno de los lenguajes con los que tu cuerpo te habla,
            pero no es el único ni el más importante. Cómo dormís,
            cómo digerís, cómo te movés, cómo te sentís — cada uno
            cuenta su parte de la historia.
          </p>
        </div>
      </FadeIn>
    </div>
  );
}

// ==================== PILATES ====================
function PagePilates({ sesionesPilates = [], registrarPilatesSesion }) {
  const [selected, setSelected] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const safeSesiones = Array.isArray(sesionesPilates) ? sesionesPilates : [];

  const handleRegister = (routineId) => {
    registrarPilatesSesion(routineId);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    setSelected(null);
  };

  const thisWeekCount = safeSesiones.filter((s) => weekKey(new Date(s.date)) === weekKey()).length;
  const totalCount = safeSesiones.length;

  return (
    <div>
      <BotanicalConfetti show={showConfetti} />
      <EditorialKicker>Movimiento consciente · Pilates</EditorialKicker>
      <EditorialHero line1="Control," line2="respiración."
        subtitle="Complemento perfecto al gym. Postura, core, flexibilidad." />

      <FadeIn delay={150}>
        <GradientCard gradient={`linear-gradient(135deg, ${T.success}30 0%, ${T.gold}20 50%, ${T.accent}20 100%)`}
          style={{ marginTop: 22, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                Esta semana
              </div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 84, lineHeight: 0.9,
                color: T.ink, marginTop: 12, letterSpacing: -3,
                fontWeight: 400, fontStyle: "italic",
              }}>
                {thisWeekCount}
                <span style={{ fontSize: 28, fontStyle: "normal", opacity: 0.5 }}>/3</span>
              </div>
            </div>
            <Illustration type="pilates" size={50} color={T.ink} stroke={1.4} />
          </div>
          <div style={{ marginTop: 20, height: 6, background: "rgba(255,255,255,0.5)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(100, (thisWeekCount / 3) * 100)}%`,
              background: `linear-gradient(90deg, ${T.success}, ${T.gold})`,
              borderRadius: 999, transition: `width ${TX_SMOOTH}`,
            }} />
          </div>
        </GradientCard>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionHeader roman="I" title="Elige tu rutina" subtitle="Según lo que tu cuerpo pide hoy." />
      </FadeIn>

      {Object.entries(PILATES_ROUTINES).map(([key, routine], i) => {
        const romanNum = ["I", "II", "III"][i];
        return (
          <FadeIn key={key} delay={350 + i * 60}>
            <Card glass style={{
              marginBottom: 14,
              border: selected === key ? `2px solid ${T.accentDeep}` : `1px solid rgba(234, 221, 210, 0.6)`,
            }}>
              <div onClick={() => setSelected(selected === key ? null : key)}
                style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  fontFamily: FONT_SERIF, fontSize: 36, fontStyle: "italic",
                  color: T.accent, lineHeight: 0.9, opacity: 0.8, minWidth: 30,
                }}>{romanNum}</div>
                <div style={{ flex: 1 }}>
                  <H3 style={{ fontSize: 18 }}>{routine.title}</H3>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <Pill>{routine.duration} min</Pill>
                    <Pill color={T.gold}>{routine.exercises.length} ejercicios</Pill>
                  </div>
                  <p style={{ fontSize: 12, color: T.inkMid, margin: "12px 0 0 0", lineHeight: 1.5 }}>
                    <span style={{ color: T.accentDeep, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>
                      Foco ·
                    </span> {routine.focus}
                  </p>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: selected === key ? T.accentDeep : T.bgAlt,
                  color: selected === key ? "white" : T.ink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, transition: `all ${TX_SMOOTH}`,
                  transform: selected === key ? "rotate(45deg)" : "rotate(0)", flexShrink: 0,
                }}>+</div>
              </div>
              {selected === key && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.lineSoft}` }}>
                  <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                    Secuencia
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {routine.exercises.map((ex, j) => (
                      <div key={j} style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "10px 0",
                        borderBottom: j < routine.exercises.length - 1 ? `1px solid ${T.lineSoft}` : "none",
                      }}>
                        <div style={{
                          fontFamily: FONT_SERIF, fontSize: 14, fontStyle: "italic",
                          color: T.accentDeep, minWidth: 20,
                        }}>{String(j + 1).padStart(2, "0")}</div>
                        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{ex}</div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => handleRegister(key)} fullWidth style={{
                    marginTop: 18,
                    background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
                  }}>✓ Completé esta rutina</Button>
                </div>
              )}
            </Card>
          </FadeIn>
        );
      })}
    </div>
  );
}

// ==================== CUELLO ====================
function PageNeck({ registrarCuello, sesionesCuello = [], currentStreak }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const intervalRef = useRef(null);

  const safeSesiones = Array.isArray(sesionesCuello) ? sesionesCuello : [];

  useEffect(() => {
    if (safeSesiones.includes(todayStr())) setDoneToday(true);
  }, [safeSesiones]);

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { setRunning(false); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, timeLeft]);

  const startTimer = (idx, duration) => {
    setActiveIdx(idx);
    setTimeLeft(duration);
    setRunning(true);
  };

  const handleComplete = () => {
    registrarCuello();
    setDoneToday(true);
    setShowConfetti(true);
    haptic("celebration");
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const totalTime = NECK_PROTOCOL.reduce((s, e) => s + e.duration, 0);

  return (
    <div>
      <BotanicalConfetti show={showConfetti} />
      <EditorialKicker>Reeducación postural · Diario</EditorialKicker>
      <EditorialHero line1="Protocolo" line2="de cuello."
        subtitle={`${Math.round(totalTime / 60)} minutos al día para revertir el patrón.`} />

      <FadeIn delay={150}>
        <GradientCard gradient={GRADIENTS.earth} style={{ marginTop: 22, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                Tu racha
              </div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 84, lineHeight: 0.9,
                color: T.ink, marginTop: 12, letterSpacing: -3,
                fontWeight: 400, fontStyle: "italic",
              }}>{currentStreak}</div>
              <div style={{
                fontSize: 11, color: T.ink, opacity: 0.6,
                letterSpacing: 2, textTransform: "uppercase", marginTop: 4,
              }}>{currentStreak === 1 ? "día consecutivo" : "días consecutivos"}</div>
            </div>
            <Illustration type="neck" size={50} color={T.ink} stroke={1.4} />
          </div>
          <div style={{
            marginTop: 22, paddingTop: 18,
            borderTop: `1px solid rgba(58,43,38,0.1)`,
            fontFamily: FONT_SERIF, fontSize: 14, fontStyle: "italic",
            color: T.ink, lineHeight: 1.55, opacity: 0.85,
          }}>"Tu dolor constante viene del cuello adelantado por trabajar sentada. Este protocolo, hecho a diario, revierte el patrón."</div>
        </GradientCard>
      </FadeIn>

      <FadeIn delay={300}>
        <div style={{ marginTop: 20 }}>
          {doneToday ? (
            <Card glass style={{
              textAlign: "center", padding: 22,
              background: `${T.success}15`, border: `1px solid ${T.success}40`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✓</div>
              <H3 style={{ color: T.success }}>Completado hoy</H3>
            </Card>
          ) : (
            <Button onClick={handleComplete} fullWidth style={{
              padding: "16px 22px", fontSize: 14, fontWeight: 600,
              background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
            }}>Marcar sesión completa</Button>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={450}>
        <SectionHeader roman="I" title="Los cinco pasos" subtitle="Hazlos en orden, sin prisa." />
      </FadeIn>

      {NECK_PROTOCOL.map((ex, i) => {
        const isActive = activeIdx === i && running;
        return (
          <FadeIn key={ex.id} delay={500 + i * 50}>
            <Card glass style={{
              marginBottom: 12,
              border: isActive ? `2px solid ${T.accentDeep}` : `1px solid rgba(234, 221, 210, 0.6)`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: FONT_SERIF, fontSize: 42, fontStyle: "italic",
                    color: T.accent, lineHeight: 0.9, letterSpacing: -1, opacity: 0.8,
                  }}>{["I", "II", "III", "IV", "V"][i]}</div>
                  <H3 style={{ fontSize: 18, marginTop: 8 }}>{ex.name}</H3>
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Pill color={T.accentDeep}>{ex.reps}</Pill>
                  </div>
                </div>
                <button onClick={() => startTimer(i, ex.duration)} style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 100%)`,
                  border: "none", color: "white", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: `all ${TX_SMOOTH}`, flexShrink: 0,
                }}>
                  {isActive ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: FONT_SERIF, fontSize: 22, fontStyle: "italic" }}>{timeLeft}</div>
                      <div style={{ fontSize: 8, letterSpacing: 1, fontWeight: 600 }}>SEG</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, marginBottom: 2 }}>▶</div>
                      <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 600 }}>INICIAR</div>
                    </div>
                  )}
                </button>
              </div>
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.lineSoft}` }}>
                <div style={{ fontSize: 9, color: T.accentDeep, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                  Técnica
                </div>
                <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: "8px 0 0 0" }}>{ex.tech}</p>
              </div>
              <div style={{
                fontSize: 13, color: T.ink, lineHeight: 1.55,
                marginTop: 14, padding: 14,
                background: `linear-gradient(135deg, ${T.bgAlt} 0%, ${T.bgSoft} 100%)`,
                borderRadius: 12, fontStyle: "italic", fontFamily: FONT_SERIF,
                borderLeft: `3px solid ${T.gold}`,
              }}>"{ex.cue}"</div>
            </Card>
          </FadeIn>
        );
      })}
    </div>
  );
}

// ==================== RETOS ====================
function PageChallenges({ weeklyStatus, monthlyStatus, goTo,
  recompensasDesbloqueadas = [], registrarRecompensa }) {
  const [showReward, setShowReward] = useState(null);
  const safeRewards = Array.isArray(recompensasDesbloqueadas) ? recompensasDesbloqueadas : [];
  const weekComplete = weeklyStatus.gym >= 3 && weeklyStatus.pilates >= 3 && weeklyStatus.neck >= 7;
  const totalWeek = weeklyStatus.gym + weeklyStatus.pilates + weeklyStatus.neck;
  const weekPct = Math.round((totalWeek / 13) * 100);

  return (
    <div>
      <EditorialKicker>Constancia · Recompensas</EditorialKicker>
      <EditorialHero line1="Tus retos," line2="tu cuidado."
        subtitle="Semanal, mensual, y celebraciones que te mereces." />

      {/* Acceso sutil a la galería de rituales */}
      <div style={{ textAlign: "center", margin: "4px 0 20px" }}>
        <MagneticHover strength={6}>
          <button
            onClick={() => goTo?.("rituals")}
            style={{
              background: "transparent",
              border: `1px solid ${T.gold}35`,
              color: T.gold,
              fontFamily: FONT_SANS,
              fontSize: 11,
              fontVariantCaps: "all-small-caps",
              fontFeatureSettings: '"smcp" 1, "c2sc" 1',
              letterSpacing: "0.2em",
              padding: "8px 20px",
              borderRadius: 20,
              cursor: "pointer",
            }}
          >
            Ver tus rituales ✦
          </button>
        </MagneticHover>
      </div>

      <FadeIn delay={150}>
        <GradientCard gradient={weekComplete
          ? `linear-gradient(135deg, ${T.success}35 0%, ${T.gold}25 100%)`
          : GRADIENTS.aurora}
          style={{ marginTop: 22, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, color: T.ink, opacity: 0.7 }}>
                Esta semana
              </div>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 84, lineHeight: 0.9,
                color: T.ink, marginTop: 12, letterSpacing: -3,
                fontWeight: 400, fontStyle: "italic",
              }}>
                {weekPct}
                <span style={{ fontSize: 28, fontStyle: "normal", opacity: 0.5 }}>%</span>
              </div>
            </div>
            <Illustration type="heart" size={50} color={T.ink} stroke={1.4} />
          </div>
          <div style={{ marginTop: 20, height: 6, background: "rgba(255,255,255,0.5)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${weekPct}%`,
              background: weekComplete
                ? `linear-gradient(90deg, ${T.success}, ${T.gold})`
                : `linear-gradient(90deg, ${T.accent}, ${T.accentDeep})`,
              borderRadius: 999,
            }} />
          </div>
        </GradientCard>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionHeader roman="I" title="Tu semana" subtitle="3 gym + 3 Pilates + 7 días de cuello." />
        <Card glass>
          <ChallengeRow label="Sesiones de gym" value={weeklyStatus.gym} max={3} />
          <ChallengeRow label="Pilates" value={weeklyStatus.pilates} max={3} />
          <ChallengeRow label="Protocolo de cuello" value={weeklyStatus.neck} max={7} />
          {weekComplete && (
            <div style={{
              marginTop: 18, padding: 24,
              background: `linear-gradient(135deg, ${T.success}20 0%, ${T.gold}15 100%)`,
              borderRadius: 18, textAlign: "center",
              border: `1px solid ${T.success}40`,
            }}>
              <div style={{ fontSize: 40, marginBottom: 4 }}>🌸</div>
              <h3 style={{
                fontFamily: FONT_SERIF, fontSize: 22, margin: "4px 0 0 0",
                color: T.ink, fontStyle: "italic",
              }}>Semana completa.</h3>
              <p style={{ margin: "6px 0 14px 0", fontSize: 13, color: T.inkMid }}>
                Te la ganaste. Elige cómo celebrar.
              </p>
              <Button onClick={() => setShowReward("weekly")} style={{
                background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.gold} 100%)`,
              }}>Elegir recompensa</Button>
            </div>
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={450}>
        <SectionHeader roman="II" title="Tu mes" subtitle="Tres dimensiones avanzando en paralelo." />
      </FadeIn>

      {MONTHLY_CHALLENGES.map((c, i) => {
        const romanNum = ["I", "II", "III"][i];
        const isActive = monthlyStatus[c.id];
        return (
          <FadeIn key={c.id} delay={500 + i * 60}>
            <Card glass style={{
              marginBottom: 12,
              background: isActive
                ? `linear-gradient(135deg, ${T.success}12 0%, rgba(255,255,255,0.5) 100%)`
                : undefined,
              borderLeft: isActive ? `3px solid ${T.success}` : undefined,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  fontFamily: FONT_SERIF, fontSize: 32, fontStyle: "italic",
                  color: isActive ? T.success : T.accent, lineHeight: 0.9, opacity: 0.8, minWidth: 30,
                }}>{romanNum}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{c.icon}</span>
                      <H3 style={{ fontSize: 17 }}>{c.label}</H3>
                    </div>
                    <Pill color={isActive ? T.success : T.inkSoft}>
                      {isActive ? "En progreso" : "Pendiente"}
                    </Pill>
                  </div>
                  <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, margin: "12px 0 0 0" }}>
                    {c.target}
                  </p>
                  <div style={{
                    fontSize: 11, color: T.inkMid, margin: "8px 0 0 0",
                    fontStyle: "italic", fontFamily: FONT_SERIF,
                  }}>{c.criteria}</div>
                </div>
              </div>
            </Card>
          </FadeIn>
        );
      })}

      {safeRewards.length > 0 && (
        <>
          <FadeIn delay={700}>
            <SectionHeader roman="III" title="Tus celebraciones" />
          </FadeIn>
          {safeRewards.slice(-5).reverse().map((r, i) => (
            <FadeIn key={i} delay={750 + i * 40}>
              <Card glass style={{ marginBottom: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `linear-gradient(135deg, ${T.gold}30 0%, ${T.accent}20 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>{REWARDS[r.type]?.icon}</div>
                    <div>
                      <div style={{
                        fontFamily: FONT_SERIF, fontSize: 15, color: T.ink,
                        fontStyle: "italic",
                      }}>{r.description}</div>
                      <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 2, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
                        {REWARDS[r.type]?.label}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: FONT_SERIF, fontStyle: "italic" }}>
                    {r.date}
                  </span>
                </div>
              </Card>
            </FadeIn>
          ))}
        </>
      )}

      {showReward && (
        <RewardModal onClose={() => setShowReward(null)}
          onSave={(data) => { registrarRecompensa(data); setShowReward(null); }} />
      )}
    </div>
  );
}

function RewardModal({ onClose, onSave }) {
  const [type, setType] = useState(null);
  const [description, setDescription] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(58, 43, 38, 0.4)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 100, padding: 16,
      animation: "fadeIn 200ms ease-out",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.card, borderRadius: 28, padding: 30,
        maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: SHADOW_ELEV,
      }}>
        <EditorialKicker>Celebración · Tu recompensa</EditorialKicker>
        <h2 style={{
          fontFamily: FONT_SERIF, fontSize: 32, margin: "10px 0 0 0",
          color: T.ink, fontStyle: "italic", letterSpacing: -0.8, lineHeight: 1,
        }}>Elige cómo<br/>celebrar.</h2>
        <p style={{ color: T.inkMid, fontSize: 13, margin: "14px 0 22px 0", lineHeight: 1.5 }}>
          Te la ganaste. Disfrútala sin culpa.
        </p>

        {Object.entries(REWARDS).map(([key, r]) => (
          <button key={key} onClick={() => setType(key)} style={{
            width: "100%", padding: 18, marginBottom: 10, borderRadius: 16,
            border: `1px solid ${type === key ? T.accentDeep : T.line}`,
            background: type === key
              ? `linear-gradient(135deg, ${T.bgAlt} 0%, rgba(255,255,255,0.8) 100%)`
              : T.card,
            textAlign: "left", cursor: "pointer", fontFamily: FONT_SANS,
            transition: `all ${TX_SMOOTH}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: type === key
                  ? `linear-gradient(135deg, ${T.gold}40 0%, ${T.accent}30 100%)`
                  : T.bgAlt,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24,
              }}>{r.icon}</div>
              <div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 16, color: T.ink, fontWeight: 500 }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>
                  {r.examples.join(" · ")}
                </div>
              </div>
            </div>
          </button>
        ))}

        {type && (
          <>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu celebración..."
              style={{ ...inputStyle, textAlign: "left", padding: 14, fontSize: 14, marginTop: 8 }}
              autoFocus />
            <Button onClick={() => onSave({
              type, description: description || REWARDS[type].label, date: todayStr(),
            })} fullWidth style={{ marginTop: 14 }}>Guardar celebración</Button>
          </>
        )}

        <Button onClick={onClose} variant="ghost" fullWidth style={{ marginTop: 10 }}>Cerrar</Button>
      </div>
    </div>
  );
}

// ==================== NUTRICIÓN ====================
function PageNutrition({ coach }) {
  const [q, setQ] = useState("");
  const [r, setR] = useState("");

  const ask = async () => {
    if (!q.trim()) return;
    const res = await coach.ask(q);
    if (res) setR(res);
  };

  return (
    <div>
      <EditorialKicker>Alimentación · Emociones</EditorialKicker>
      <EditorialHero line1="Cuidarte," line2="no castigarte."
        subtitle="Principios suaves, sin dietas rígidas." />

      <FadeIn delay={120}>
        <Card glass style={{
          marginTop: 22, background: `${T.warn}10`, border: `1px solid ${T.warn}30`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.warn, marginTop: 6, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 9, color: T.warn, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
                Recordatorio
              </div>
              <p style={{ margin: "6px 0 0 0", fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
                Busca un nutricionista para tu caso. Esto es guía general.
              </p>
            </div>
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={250}>
        <SectionHeader roman="I" title="Cuatro principios" />
      </FadeIn>

      {NUTRITION_PRINCIPLES.map((p, i) => {
        const romanNum = ["I", "II", "III", "IV"][i];
        const colors = [T.success, T.accentDeep, T.gold, T.accent];
        const c = colors[i];
        return (
          <FadeIn key={i} delay={300 + i * 60}>
            <Card glass style={{ marginBottom: 12, borderLeft: `3px solid ${c}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  fontFamily: FONT_SERIF, fontSize: 32, fontStyle: "italic",
                  color: c, lineHeight: 0.9, opacity: 0.8, minWidth: 30,
                }}>{romanNum}</div>
                <div style={{ flex: 1 }}>
                  <H3 style={{ fontSize: 17 }}>{p.title}</H3>
                  <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: "10px 0 0 0" }}>{p.body}</p>
                </div>
              </div>
            </Card>
          </FadeIn>
        );
      })}

      <FadeIn delay={600}>
        <SectionHeader roman="II" title="Ansiedad nocturna" subtitle="Tu protocolo cuando ataque." />
      </FadeIn>

      <FadeIn delay={680}>
        <GradientCard gradient={`linear-gradient(135deg, ${T.accent}25 0%, ${T.bgAlt} 50%, ${T.bgSoft} 100%)`}
          style={{ padding: 26 }}>
          {ANXIETY_NIGHT.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "12px 0",
              borderBottom: i < ANXIETY_NIGHT.length - 1 ? `1px solid rgba(234, 221, 210, 0.4)` : "none",
            }}>
              <div style={{
                fontFamily: FONT_SERIF, fontSize: 16, fontStyle: "italic",
                color: T.accentDeep, minWidth: 24, fontWeight: 500,
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, flex: 1 }}>{step}</div>
            </div>
          ))}
        </GradientCard>
      </FadeIn>

      <FadeIn delay={900}>
        <SectionHeader roman="III" title="Pregunta a tu coach" />
        <Card glass>
          <textarea value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: ¿qué cenar con pollo y quinoa?"
            rows={3}
            style={{
              width: "100%", padding: 16, border: `1px solid ${T.line}`,
              borderRadius: 14, fontSize: 14, color: T.ink,
              background: "rgba(251, 241, 233, 0.7)",
              resize: "none", boxSizing: "border-box",
              fontFamily: FONT_SANS, outline: "none", lineHeight: 1.5,
            }} />
          <Button onClick={ask} disabled={coach.loading} fullWidth style={{ marginTop: 12 }}>
            {coach.loading ? "Escuchándote..." : "Preguntar"}
          </Button>
          {r && (
            <div style={{
              marginTop: 16, padding: 18, background: GRADIENTS.lunar,
              borderRadius: 16, fontSize: 14, color: T.ink, lineHeight: 1.65,
              whiteSpace: "pre-wrap", fontFamily: FONT_SERIF, fontStyle: "italic",
              borderLeft: `3px solid ${T.gold}`,
            }}>{r}</div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}

// Iconos nav
const NavIcon = ({ type, active, size = 20 }) => {
  const color = active ? T.accentDeep : T.inkSoft;
  const props = { stroke: color, strokeWidth: active ? 1.8 : 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "home") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path {...props} d="M 4 12 L 12 4 L 20 12" />
      <path {...props} d="M 6 11 L 6 20 L 18 20 L 18 11" />
    </svg>
  );
  if (type === "gym") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path {...props} d="M 3 9 L 3 15" />
      <path {...props} d="M 6 7 L 6 17" />
      <path {...props} d="M 6 12 L 18 12" />
      <path {...props} d="M 18 7 L 18 17" />
      <path {...props} d="M 21 9 L 21 15" />
    </svg>
  );
  if (type === "cycle") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" {...props} />
      <path {...props} d="M 12 4 Q 8 12, 12 20 Q 16 12, 12 4" fill={color} fillOpacity={active ? 0.3 : 0.15} />
    </svg>
  );
  if (type === "body") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="6" r="2.5" {...props} />
      <path {...props} d="M 9 10 Q 12 8, 15 10 L 15 15 Q 12 17, 9 15 Z" />
      <path {...props} d="M 9 15 L 8 21" />
      <path {...props} d="M 15 15 L 16 21" />
    </svg>
  );
  if (type === "challenges") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path {...props} d="M 12 4 L 14 10 L 20 10 L 15 14 L 17 20 L 12 16 L 7 20 L 9 14 L 4 10 L 10 10 Z"
        fill={active ? T.gold : "none"} fillOpacity={active ? 0.3 : 0} />
    </svg>
  );
  return null;
};

/* ============================================================
   PAGE RITUALS — Galería narrativa de logros desbloqueados
   ============================================================ */
function PageRituals({ goTo, streak, sesionesGym, sesionesPilates, sesionesCuello,
  bodyMetrics, painLog, cycleHistory, lastPeriod, cycleType }) {

  // Reutilizamos el mismo hook de achievements para leer estado
  const achievements = useAchievements({
    streak, sesionesGym, sesionesPilates, sesionesCuello,
    bodyMetrics, painLog, cycleHistory, lastPeriod, cycleType,
  });

  // Temporada actual para contexto visual
  const { season } = useNarrativeSeason();

  const unlockedCount = Object.keys(achievements.unlocked || {}).length;
  const totalCount = ACHIEVEMENTS.length;
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div>
      {/* Hero editorial */}
      <div style={{ textAlign: "center", padding: "32px 24px 8px" }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 10,
            fontVariantCaps: "all-small-caps",
            fontFeatureSettings: '"smcp" 1, "c2sc" 1',
            letterSpacing: "0.35em",
            color: T.inkMid,
            marginBottom: 10,
          }}
        >
          Tu colección
        </div>
        <EditorialTitle level={1} italic>
          Rituales
        </EditorialTitle>
        <p
          style={{
            marginTop: 14,
            fontFamily: FONT_SERIF,
            fontSize: 14,
            fontStyle: "italic",
            color: T.inkSoft,
            maxWidth: 360,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.55,
          }}
        >
          Cada medalla es un capítulo.
          No se persigue: aparece cuando habitás tu ritmo.
        </p>

        {/* Progreso global minimalista */}
        <div
          style={{
            marginTop: 28,
            maxWidth: 280,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div
            style={{
              height: 1,
              background: `${T.gold}30`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: T.gold,
                transition: "width 900ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: FONT_SANS,
              fontSize: 10,
              letterSpacing: "0.25em",
              color: T.inkSoft,
              fontVariantCaps: "all-small-caps",
              fontFeatureSettings: '"smcp" 1, "c2sc" 1',
            }}
          >
            <SpringNumber value={unlockedCount} /> de {totalCount} desbloqueados
          </div>
        </div>
      </div>

      <Ornament variant="star" spacing={24} />

      {/* Galería existente - ya maneja categorías y estado locked */}
      <AchievementsGallery unlocked={achievements.unlocked} onBack={() => goTo("home")} />
    </div>
  );
}

// ==================== APP ====================
export default function Aura() {
  const [page, setPage] = useState("home");
  const [energy, setEnergy] = useState("media");
  const coach = useClaudeCoach();

  const [historialEj, setHistorialEj] = useStorage("aura-historial", {});
  const [sesionesGym, setSesionesGym] = useStorage("aura-gym", []);
  const [sesionesPilates, setSesionesPilates] = useStorage("aura-pilates", []);
  const [sesionesCuello, setSesionesCuello] = useStorage("aura-cuello", []);
  const [recompensas, setRecompensas] = useStorage("aura-rewards", []);
  const [lastPeriod, setLastPeriod] = useStorage("aura-last-period", null);
  const [cycleHistory, setCycleHistory] = useStorage("aura-cycle-history", []);
  const [cycleType, setCycleType] = useStorage("aura-cycle-type", null);
  const [cycleSymptoms, setCycleSymptoms] = useStorage("aura-cycle-symptoms", {});
  const [bodyMetrics, setBodyMetrics] = useStorage("aura-body-metrics", {});
  const [painLog, setPainLog] = useStorage("aura-pain-log", []);
  const [userProfile, setUserProfile] = useStorage("aura-user-profile", null);
  const [dailyRituals, setDailyRituals] = useStorage("aura-daily-rituals", {});

  const handleOnboardingComplete = (profile) => {
    setUserProfile({ ...profile, completedAt: todayStr() });
    if (profile.cycleType) setCycleType(profile.cycleType);
  };

  const handleRitualComplete = (data) => {
    const today = todayStr();
    setDailyRituals({ ...(dailyRituals || {}), [today]: data });
  };

  const todayRitual = (dailyRituals || {})[todayStr()];
  const shouldShowRitual = userProfile && !todayRitual;

  const registrarSesion = (day, exId, sets) => {
    const today = todayStr();
    const nuevoHist = { ...(historialEj || {}) };
    if (!nuevoHist[exId]) nuevoHist[exId] = [];
    nuevoHist[exId] = [...nuevoHist[exId], { date: today, day, sets }];
    setHistorialEj(nuevoHist);
    const safe = Array.isArray(sesionesGym) ? sesionesGym : [];
    if (!safe.some((s) => s.date === today)) {
      setSesionesGym([...safe, { date: today, day }]);
    }
  };

  const registrarPilatesSesion = (routineId) => {
    const today = todayStr();
    const safe = Array.isArray(sesionesPilates) ? sesionesPilates : [];
    setSesionesPilates([...safe, { date: today, routine: routineId }]);
  };

  const registrarCuello = () => {
    const today = todayStr();
    const safe = Array.isArray(sesionesCuello) ? sesionesCuello : [];
    if (!safe.includes(today)) {
      setSesionesCuello([...safe, today]);
    }
  };

  const registrarRecompensa = (data) => {
    const safe = Array.isArray(recompensas) ? recompensas : [];
    setRecompensas([...safe, data]);
  };

  const currentWeek = weekKey();
  const isInCurrentWeek = (dateStr) => weekKey(new Date(dateStr)) === currentWeek;

  const safeGym = Array.isArray(sesionesGym) ? sesionesGym : [];
  const safePilates = Array.isArray(sesionesPilates) ? sesionesPilates : [];
  const safeCuello = Array.isArray(sesionesCuello) ? sesionesCuello : [];
  const pilatesDates = safePilates.map((s) => typeof s === "string" ? s : s.date);

  const weeklyStatus = {
    gym: safeGym.filter((s) => isInCurrentWeek(s.date)).length,
    pilates: pilatesDates.filter(isInCurrentWeek).length,
    neck: safeCuello.filter(isInCurrentWeek).length,
  };

  const calcStreak = () => {
    if (safeCuello.length === 0) return 0;
    const sorted = [...safeCuello].sort().reverse();
    let streak = 0;
    let currentDate = new Date();
    for (let i = 0; i < 365; i++) {
      const checkStr = currentDate.toISOString().slice(0, 10);
      if (sorted.includes(checkStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        if (i === 0) {
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  const currentMonth = monthKey();
  const isInCurrentMonth = (dateStr) => dateStr.startsWith(currentMonth);
  const safeBody = bodyMetrics && typeof bodyMetrics === "object" ? bodyMetrics : {};
  const monthlyStatus = {
    strength: safeGym.filter((s) => isInCurrentMonth(s.date)).length >= 4,
    composition: (safeBody.weight || []).filter((r) => isInCurrentMonth(r.date)).length >= 4,
    habits: weeklyStatus.gym > 0 && weeklyStatus.pilates > 0 && weeklyStatus.neck > 0,
  };

  const streak = calcStreak();

  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const pilatesArrayForPage = safePilates.map((s) =>
    typeof s === "string" ? { date: s, routine: "general" } : s);

  const pages = {
    home: <PageHome goTo={setPage} coach={coach}
            weeklyStatus={weeklyStatus} currentStreak={streak}
            energy={energy} setEnergy={setEnergy}
            lastPeriod={lastPeriod} cycleType={cycleType}
            painLog={painLog} setPainLog={setPainLog}
            userName={userProfile?.name || "Fer"}
            historialEj={historialEj}
            sesionesGym={sesionesGym}
            sesionesPilates={sesionesPilates}
            sesionesCuello={sesionesCuello}
            cycleHistory={cycleHistory}
            cycleSymptoms={cycleSymptoms}
            bodyMetrics={bodyMetrics} />,
    gym: <PageGym coach={coach} registrarSesion={registrarSesion}
           historial={historialEj || {}} energy={energy} setEnergy={setEnergy}
           lastPeriod={lastPeriod} cycleType={cycleType} />,
    cycle: <PageCycle lastPeriod={lastPeriod} setLastPeriod={setLastPeriod}
             cycleHistory={cycleHistory} setCycleHistory={setCycleHistory}
             cycleType={cycleType} setCycleType={setCycleType}
             cycleSymptoms={cycleSymptoms} setCycleSymptoms={setCycleSymptoms} />,
    body: <PageBody bodyMetrics={bodyMetrics} setBodyMetrics={setBodyMetrics} />,
    pilates: <PagePilates sesionesPilates={pilatesArrayForPage}
               registrarPilatesSesion={registrarPilatesSesion} />,
    neck: <PageNeck registrarCuello={registrarCuello}
            sesionesCuello={sesionesCuello} currentStreak={streak} />,
    challenges: <PageChallenges weeklyStatus={weeklyStatus} monthlyStatus={monthlyStatus}
                  goTo={setPage}
                  recompensasDesbloqueadas={recompensas} registrarRecompensa={registrarRecompensa} />,
    nutrition: <PageNutrition coach={coach} />,
    rituals: <PageRituals goTo={setPage}
               streak={streak}
               sesionesGym={sesionesGym}
               sesionesPilates={sesionesPilates}
               sesionesCuello={sesionesCuello}
               bodyMetrics={bodyMetrics}
               painLog={painLog}
               cycleHistory={cycleHistory}
               lastPeriod={lastPeriod}
               cycleType={cycleType} />,
  };

  const nav = [
    { id: "home", label: "Inicio" },
    { id: "gym", label: "Gym" },
    { id: "cycle", label: "Ciclo" },
    { id: "body", label: "Cuerpo" },
    { id: "challenges", label: "Retos" },
  ];

  const atmosphere = getAtmosphere();
  const appWeather = useWeather();
  const weatherInfo = appWeather ? decodeWeather(appWeather.code) : null;

  return (
    <div style={{
      minHeight: "100vh", background: atmosphere.gradient,
      fontFamily: FONT_SANS, color: T.ink, paddingBottom: 92,
      position: "relative",
      transition: "background 2s ease-in-out",
    }}>
      {weatherInfo && <WeatherParticles mood={weatherInfo.particles} />}
      <div style={{
        position: "fixed", top: "-100px", right: "-100px",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${atmosphere.glow}40 0%, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
        animation: "floatGlow 20s ease-in-out infinite",
      }} />
      <div style={{
        position: "fixed", bottom: "-100px", left: "-100px",
        width: 350, height: 350, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.accent}25 0%, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
        animation: "floatGlow 25s ease-in-out infinite reverse",
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        body {
          margin: 0;
          /* Ligatures y alternativos activados globalmente */
          font-feature-settings: "liga" 1, "calt" 1, "kern" 1;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Tipografía serif con todas las features OpenType */
        h1, h2, h3, .serif {
          font-feature-settings: "liga" 1, "calt" 1, "dlig" 1, "swsh" 1, "kern" 1, "hist" 1;
          font-variant-ligatures: discretionary-ligatures historical-ligatures;
        }

        /* Números tabulares para stats (alineados) */
        .tabular-nums, .stat-value {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "lnum" 1;
        }

        /* Números old-style para prosa elegante */
        .oldstyle-nums {
          font-variant-numeric: oldstyle-nums;
          font-feature-settings: "onum" 1;
        }

        /* Smallcaps reales (no text-transform) */
        .smallcaps {
          font-variant-caps: all-small-caps;
          font-feature-settings: "smcp" 1, "c2sc" 1;
          letter-spacing: 0.08em;
        }

        /* Petite caps: a mitad de camino entre smallcaps y minúsculas */
        .petite-caps {
          font-variant-caps: petite-caps;
          font-feature-settings: "pcap" 1;
        }

        /* Swash caps: mayúsculas con colas decorativas (inicios de sección) */
        .swash {
          font-feature-settings: "swsh" 1, "cswh" 1, "salt" 1;
          font-variant-alternates: swash(default);
        }

        /* Stylistic set 01 de Playfair (alternativas elegantes) */
        .stylistic-alt {
          font-feature-settings: "ss01" 1, "ss02" 1;
        }

        /* Historical forms (formas históricas en cursiva) */
        .historical {
          font-feature-settings: "hist" 1, "hlig" 1;
          font-variant-alternates: historical-forms;
        }

        /* Fracciones automáticas: 1/2 → ½ */
        .fractions {
          font-variant-numeric: diagonal-fractions;
          font-feature-settings: "frac" 1;
        }

        /* Ordinal markers: 1a 2o → 1ª 2º */
        .ordinals {
          font-feature-settings: "ordn" 1;
          font-variant-numeric: ordinal;
        }

        /* Superíndice/subíndice tipográficos verdaderos */
        .sup-real { font-feature-settings: "sups" 1; vertical-align: baseline; }
        .sub-real { font-feature-settings: "subs" 1; vertical-align: baseline; }

        /* Títulos serif grandes: toda la suite activada */
        .editorial-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-feature-settings: "liga" 1, "dlig" 1, "calt" 1, "kern" 1,
                                 "swsh" 1, "cswh" 1, "hist" 1, "hlig" 1,
                                 "ss01" 1, "onum" 0, "lnum" 1;
          font-variant-ligatures: common-ligatures discretionary-ligatures historical-ligatures contextual;
          text-rendering: geometricPrecision;
        }

        /* Prosa editorial: números old-style + ligatures sutiles */
        .editorial-prose {
          font-feature-settings: "liga" 1, "calt" 1, "kern" 1, "onum" 1;
          font-variant-numeric: oldstyle-nums proportional-nums;
          hyphens: auto;
          -webkit-hyphens: auto;
          hanging-punctuation: first last;
        }

        /* Drop cap editorial */
        .drop-cap::first-letter {
          font-family: 'Playfair Display', serif;
          font-size: 4.5em;
          font-weight: 400;
          font-style: italic;
          float: left;
          line-height: 0.8;
          padding-right: 10px;
          padding-top: 6px;
          color: ${T.accentDeep};
        }

        /* Drop cap alternativo: con fondo dorado sutil */
        .drop-cap-gold::first-letter {
          font-family: 'Playfair Display', serif;
          font-size: 5em;
          font-weight: 500;
          float: left;
          line-height: 0.85;
          padding: 8px 14px 4px 0;
          margin-right: 6px;
          color: ${T.gold};
          background: linear-gradient(135deg, ${T.gold} 0%, ${T.accentDeep} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Pull quote con comillas decorativas gigantes */
        .pull-quote {
          position: relative;
          padding: 28px 32px 28px 48px;
        }
        .pull-quote::before {
          content: '"';
          position: absolute;
          left: 6px;
          top: -8px;
          font-family: 'Playfair Display', serif;
          font-size: 80px;
          color: ${T.gold};
          opacity: 0.5;
          font-style: italic;
          line-height: 1;
        }

        button:hover:not(:disabled) { opacity: 0.95; }
        button:active:not(:disabled) { transform: scale(0.98); }
        input:focus, textarea:focus {
          border-color: ${T.accentDeep} !important;
          box-shadow: 0 0 0 3px ${T.accent}25;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
        @keyframes breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        @keyframes slowRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes floatGlow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 20px) scale(1.1); }
          66% { transform: translate(-20px, 30px) scale(0.95); }
        }
        @keyframes fallDown {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes drawStroke { to { stroke-dashoffset: 0; } }
        @keyframes logoFade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes weatherFall {
          from { transform: translateY(0); }
          to { transform: translateY(110vh); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {showSplash && (
        <div style={{
          position: "fixed", inset: 0,
          background: atmosphere.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, animation: "fadeOut 600ms ease-out 1000ms forwards",
        }}>
          <div style={{ textAlign: "center" }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ marginBottom: 6 }}>
              <circle cx="65" cy="65" r="55"
                fill="none" stroke={isNightTime() ? T.gold : T.accentDeep} strokeWidth="1.2"
                strokeDasharray="345" strokeDashoffset="345"
                style={{ animation: "drawStroke 1100ms ease-out forwards" }} />
              <circle cx="65" cy="65" r="38"
                fill="none" stroke={T.accent} strokeWidth="1"
                strokeDasharray="239" strokeDashoffset="239"
                style={{ animation: "drawStroke 1000ms ease-out 200ms forwards" }} />
              <circle cx="65" cy="65" r="10"
                fill={T.gold} opacity="0"
                style={{
                  animation: "logoFade 400ms ease-out 700ms forwards",
                  filter: isNightTime() ? "drop-shadow(0 0 20px rgba(232,201,156,0.6))" : "none",
                }} />
            </svg>
            <div style={{
              fontFamily: FONT_SERIF, fontSize: 52, color: T.ink,
              letterSpacing: 4, fontWeight: 400,
              opacity: 0, fontStyle: "italic",
              animation: "logoFade 600ms ease-out 850ms forwards",
              textShadow: isNightTime() ? "0 0 30px rgba(232,201,156,0.3)" : "none",
            }}>Aura</div>
            <div style={{
              marginTop: 8, fontSize: 10, color: T.inkSoft,
              letterSpacing: 6, textTransform: "uppercase", fontWeight: 500,
              opacity: 0,
              animation: "logoFade 500ms ease-out 1100ms forwards",
            }}>{isNightTime() ? "Modo nocturno" : "Tu contexto total"}</div>
          </div>
        </div>
      )}

      {/* ONBOARDING — primera vez */}
      {!showSplash && !userProfile && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {/* RITUAL DIARIO — una vez por día */}
      {!showSplash && userProfile && shouldShowRitual && (
        <DailyRitual onComplete={handleRitualComplete}
          userName={userProfile?.name || "Fer"} />
      )}

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "32px 20px", position: "relative", zIndex: 1 }} key={page}>
        {pages[page]}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderTop: `1px solid rgba(234, 221, 210, 0.6)`,
        display: "flex", justifyContent: "space-around",
        padding: "14px 0 18px 0",
        zIndex: 10,
        boxShadow: "0 -8px 32px rgba(180,130,110,0.08)",
      }}>
        {nav.map((n) => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            background: "transparent", border: "none",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 5, cursor: "pointer",
            color: page === n.id ? T.accentDeep : T.inkSoft,
            fontFamily: FONT_SANS, padding: "4px 8px",
            position: "relative",
          }}>
            {page === n.id && (
              <div style={{
                position: "absolute", top: -14, left: "50%",
                transform: "translateX(-50%)",
                width: 24, height: 2.5, borderRadius: 999,
                background: `linear-gradient(90deg, ${T.accent}, ${T.accentDeep})`,
              }} />
            )}
            <NavIcon type={n.id} active={page === n.id} size={22} />
            <span style={{
              fontSize: 10, fontWeight: page === n.id ? 600 : 500,
              letterSpacing: 0.5, marginTop: 1,
            }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
