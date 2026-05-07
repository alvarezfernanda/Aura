// Datos y predicados de logros. La parte visual (AchievementGlyph,
// AchievementReveal) sigue en App.jsx — esto es solo lógica para testear.

export const ACHIEVEMENT_CATEGORIES = {
  constancia: { label: "Constancia", color: "gold" },
  hitos: { label: "Hitos", color: "accent" },
  descubrimientos: { label: "Descubrimientos", color: "inkMid" },
  ritos: { label: "Ritos estacionales", color: "accentDeep" },
};

export const ACHIEVEMENTS = [
  // ─── CONSTANCIA ───
  {
    id: "primera_llama",
    category: "constancia",
    name: "Primera Llama",
    narrative: "Tres días seguidos.\nLo pequeño, empezando a arder.",
    glyph: "flame",
    check: (ctx) => ctx.streak >= 3,
  },
  {
    id: "raiz_firme",
    category: "constancia",
    name: "Raíz Firme",
    narrative: "Siete días.\nYa no es un impulso: es una raíz.",
    glyph: "root",
    check: (ctx) => ctx.streak >= 7,
  },
  {
    id: "nueve_lunas",
    category: "constancia",
    name: "Nueve Lunas",
    narrative: "Treinta días habitando el cuerpo.\nUn ciclo completo de presencia.",
    glyph: "moons",
    check: (ctx) => ctx.streak >= 30,
  },

  // ─── HITOS ───
  {
    id: "primer_cuerpo",
    category: "hitos",
    name: "Primer Cuerpo",
    narrative: "La primera vez que te escuchaste.\nEl resto será eco de hoy.",
    glyph: "vessel",
    check: (ctx) => ctx.totalSessions >= 1,
  },
  {
    id: "cien_gestos",
    category: "hitos",
    name: "Cien Gestos",
    narrative: "Cien movimientos conscientes.\nEl cuerpo ya te reconoce.",
    glyph: "spiral",
    check: (ctx) => ctx.totalSessions >= 100,
  },
  {
    id: "mil_respiros",
    category: "hitos",
    name: "Mil Respiros",
    narrative: "Has vuelto, una y otra vez.\nEso ya es forma de arte.",
    glyph: "infinity",
    check: (ctx) => ctx.totalSessions >= 365,
  },

  // ─── DESCUBRIMIENTOS ───
  {
    id: "carta_al_cuerpo",
    category: "descubrimientos",
    name: "Carta al Cuerpo",
    narrative: "Escribiste algo que no sabías.\nEl cuerpo también tiene palabras.",
    glyph: "letter",
    check: (ctx) => ctx.hasJournaled,
  },
  {
    id: "primera_escucha",
    category: "descubrimientos",
    name: "Primera Escucha",
    narrative: "Registraste una señal sin juzgarla.\nDolor o placer, todo es dato.",
    glyph: "ear",
    check: (ctx) => ctx.painLogCount >= 1,
  },
  {
    id: "cartografia",
    category: "descubrimientos",
    name: "Cartografía",
    narrative: "Tres fases distintas observadas.\nEmpezás a conocer tu mapa.",
    glyph: "map",
    check: (ctx) => ctx.phasesObserved >= 3,
  },

  // ─── RITOS ESTACIONALES ───
  {
    id: "sangrar_calma",
    category: "ritos",
    name: "Sangrar con Calma",
    narrative: "Atravesaste la fase roja sin huir.\nHay sabiduría en ese reposo.",
    glyph: "drop",
    check: (ctx) => ctx.periodsLogged >= 1,
  },
  {
    id: "bloom",
    category: "ritos",
    name: "Bloom",
    narrative: "Entrenaste en tu fase fértil.\nEl cuerpo en su clímax creativo.",
    glyph: "flower",
    check: (ctx) => ctx.trainedInOvulation,
  },
  {
    id: "quietud",
    category: "ritos",
    name: "Quietud",
    narrative: "Descansaste cuando tocaba descansar.\nEscuchar también es entrenar.",
    glyph: "crescent",
    check: (ctx) => ctx.restedInLuteal,
  },
];

// Helper: pasa el ctx por todos los checks y devuelve los ids que se cumplen.
export function evaluateAchievements(ctx) {
  return ACHIEVEMENTS.filter((a) => a.check(ctx)).map((a) => a.id);
}
