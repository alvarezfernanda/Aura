export const NARRATIVE_SEASONS = {
  raiz: {
    id: "raiz",
    name: "Raíz",
    subtitle: "Echar base",
    dayStart: 1,
    dayEnd: 30,
    tint: "#B8806F",
    tintSoft: "#D4A59A",
    glyph: "root",
    description:
      "El comienzo. Aprender a escuchar antes de actuar. Los cimientos se hacen en silencio.",
    mantras: [
      "Lo que se enraíza despacio, se sostiene largo.",
      "La base primero. Todo lo demás, después.",
      "Hoy no hace falta florecer. Solo echar raíz.",
      "La constancia es un gesto secreto.",
      "Los comienzos se honran con paciencia.",
      "Estás aprendiendo tu propio ritmo.",
      "El cuerpo te está conociendo también.",
    ],
    nextHint: "Pronto vendrá el florecimiento.",
  },
  bloom: {
    id: "bloom",
    name: "Bloom",
    subtitle: "Florecer",
    dayStart: 31,
    dayEnd: 75,
    tint: "#C27E6C",
    tintSoft: "#E8B4A5",
    glyph: "flower",
    description:
      "Lo sembrado se abre. Tu cuerpo responde, la energía se expande. Es momento de habitar el despliegue.",
    mantras: [
      "Lo que cultivaste está apareciendo.",
      "Tu cuerpo ya te reconoce.",
      "Florecer también es un trabajo.",
      "Hay plenitud en lo que estás construyendo.",
      "Tu energía tiene nueva forma.",
      "Estás en tu propio clímax creativo.",
      "Hoy sos la versión que sembraste.",
    ],
    nextHint: "Después del florecer viene el reposo fértil.",
  },
  quietud: {
    id: "quietud",
    name: "Quietud",
    subtitle: "Reposar",
    dayStart: 76,
    dayEnd: 120,
    tint: "#8A7A8E",
    tintSoft: "#C9B8C9",
    glyph: "crescent",
    description:
      "El ciclo se recoge. Integrar lo aprendido. El descanso no es pausa: es la forma más alta de cultivo.",
    mantras: [
      "La pausa también es sabiduría.",
      "Reposar es confiar en lo hecho.",
      "El silencio del campo ya trabaja.",
      "No todo es avanzar. A veces es sostener.",
      "Lo aprendido se integra en el descanso.",
      "Tu quietud tiene textura propia.",
      "Después de Quietud, una nueva Raíz.",
    ],
    nextHint: "Un nuevo ciclo te espera al final de este.",
  },
};

export const SEASON_CYCLE_LENGTH = 120;

export function calcNarrativeSeason(firstUseDate) {
  if (!firstUseDate) return NARRATIVE_SEASONS.raiz;
  const start = new Date(firstUseDate);
  const now = new Date();
  const daysSince = Math.floor((now - start) / 86400000) + 1;
  const dayInCycle = ((daysSince - 1) % SEASON_CYCLE_LENGTH) + 1;
  const cycleNumber = Math.floor((daysSince - 1) / SEASON_CYCLE_LENGTH) + 1;

  let season;
  if (dayInCycle <= 30) season = NARRATIVE_SEASONS.raiz;
  else if (dayInCycle <= 75) season = NARRATIVE_SEASONS.bloom;
  else season = NARRATIVE_SEASONS.quietud;

  const progress = (dayInCycle - season.dayStart) / (season.dayEnd - season.dayStart);

  return {
    ...season,
    daysSince,
    dayInCycle,
    cycleNumber,
    progress: Math.max(0, Math.min(1, progress)),
    daysIntoSeason: dayInCycle - season.dayStart + 1,
    daysLeftInSeason: season.dayEnd - dayInCycle,
    totalSeasonLength: season.dayEnd - season.dayStart + 1,
  };
}
