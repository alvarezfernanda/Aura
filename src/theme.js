// Aura — tokens compartidos por los módulos nuevos (notas, búsqueda, timeline, resumen)
// Mantiene la paleta crema/terracota/plum + Playfair / DM Sans del shell.

const isNight = () => {
  if (typeof window === "undefined") return false;
  const h = new Date().getHours();
  return h >= 20 || h < 6;
};

const T_DAY = {
  bg: "#FDF6F1",
  bgAlt: "#F7E8DD",
  bgSoft: "#FBF1E9",
  card: "#FFFFFF",
  cardGlass: "rgba(255, 255, 255, 0.78)",
  ink: "#3A2B26",
  inkMid: "#7A6A63",
  inkSoft: "#9A8A82",
  line: "#EADDD2",
  lineSoft: "#F5EADC",
  accent: "#D4A59A",
  accentDeep: "#B8806F",
  gold: "#C9A96E",
  plum: "#7B5C7A",
  plumDeep: "#5C4361",
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
  plum: "#A98AAA",
  plumDeep: "#7B5C7A",
  success: "#A8C4A0",
  warn: "#E8A094",
};

export const T = isNight() ? T_NIGHT : T_DAY;
export const FONT_SERIF = `'Playfair Display', Georgia, serif`;
export const FONT_SANS = `'DM Sans', system-ui, sans-serif`;

export const SHADOW_CARD =
  "0 1px 2px rgba(58,43,38,0.04), 0 4px 16px rgba(180,130,110,0.06), 0 16px 48px rgba(180,130,110,0.04)";

// Mapeo color por categoría — terracota / plum / oro / éxito
export const TAG_COLORS = {
  ciclo: T.plum,
  gym: T.accentDeep,
  pilates: T.success,
  cuello: T.gold,
  salud: T.warn,
  mental: T.plumDeep,
  alimentacion: T.gold,
  sueno: T.plum,
  general: T.inkSoft,
};

export const TAG_LABELS = {
  ciclo: "Ciclo",
  gym: "Gym",
  pilates: "Pilates",
  cuello: "Cuello",
  salud: "Salud",
  mental: "Mental",
  alimentacion: "Alimentación",
  sueno: "Sueño",
  general: "General",
};

export const TAG_KEYS = Object.keys(TAG_LABELS);

// Heurística de auto-tag por palabras clave (se ejecuta in-device antes de Claude)
const TAG_KEYWORDS = {
  ciclo: ["regla", "período", "periodo", "menstruación", "menstruacion", "ovulación", "ovulacion", "lútea", "lutea", "folicular", "ciclo", "sangrado", "manchado"],
  gym: ["gym", "pesas", "sentadilla", "press", "remo", "peso muerto", "rir", "serie", "repeticion", "repetición"],
  pilates: ["pilates", "core", "estabilidad", "rodillo", "swan"],
  cuello: ["cuello", "cervical", "trapecio", "rotación", "rotacion"],
  salud: ["dolor", "fiebre", "mareo", "náusea", "nausea", "migraña", "migrana", "cansancio", "fatiga"],
  mental: ["ansiedad", "estrés", "estres", "triste", "alegre", "calma", "irritable", "ánimo", "animo", "mood"],
  alimentacion: ["comida", "comí", "comi", "proteína", "proteina", "snack", "antojo", "agua"],
  sueno: ["sueño", "sueno", "dormí", "dormi", "insomnio", "siesta", "despertar"],
};

export function autoTag(text) {
  if (!text) return ["general"];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const tag of Object.keys(TAG_KEYWORDS)) {
    if (TAG_KEYWORDS[tag].some((kw) => lower.includes(kw))) found.add(tag);
  }
  if (found.size === 0) found.add("general");
  return [...found];
}

// Calcula la fase del ciclo a partir de last period + tipo (regular/irregular)
// Replica de la función calcCyclePhase de App.jsx para que los módulos nuevos
// no dependan de imports cruzados.
const PHASES_LABEL = {
  menstrual: "Menstrual",
  folicular: "Folicular",
  ovulatoria: "Ovulatoria",
  lutea: "Lútea",
  unknown: "Sin determinar",
};

export function cyclePhaseFromDate(lastPeriodDate, avgCycleLen = 28, cycleType = "regular") {
  if (!lastPeriodDate) return null;
  try {
    const last = new Date(lastPeriodDate + "T00:00:00");
    if (isNaN(last.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - last) / 86400000) + 1;
    if (diffDays < 1) return null;

    if (cycleType === "irregular") {
      if (diffDays <= 5) return { phase: "menstrual", label: PHASES_LABEL.menstrual, day: diffDays };
      return { phase: "unknown", label: PHASES_LABEL.unknown, day: diffDays };
    }
    const day = ((diffDays - 1) % avgCycleLen) + 1;
    let phase;
    if (day <= 5) phase = "menstrual";
    else if (day <= 13) phase = "folicular";
    else if (day <= 16) phase = "ovulatoria";
    else phase = "lutea";
    return { phase, label: PHASES_LABEL[phase], day };
  } catch (e) {
    return null;
  }
}

export const PHASE_COLORS = {
  menstrual: "#C27E6C",
  folicular: "#8BA888",
  ovulatoria: "#C9A96E",
  lutea: "#7B5C7A",
  unknown: "#9A8A82",
};
