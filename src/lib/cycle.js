export const CYCLE_PHASES = {
  menstrual: {
    name: "Menstrual", days: "1-5", color: "#C27E6C", icon: "◐",
    energy: "baja",
    training: "Descanso activo o Pilates muy suave. Si entrenas, volumen bajo, sin peso pesado.",
    nutrition: "Hierro (carnes rojas, espinaca), magnesio (chocolate 85%, almendras). Evita cafeína extra.",
    mood: "Necesitas introspección. Permítete bajar el ritmo sin culpa.",
  },
  folicular: {
    name: "Folicular", days: "6-13", color: "#D4A59A", icon: "◑",
    energy: "media-alta",
    training: "Sube cargas. Cuerpo responde mejor. Día ideal para PRs en hip thrust o peso muerto.",
    nutrition: "Proteína alta, carbohidratos complejos. Tu insulina está estable — aprovecha.",
    mood: "Expansiva, creativa, social. Buen momento para decisiones grandes.",
  },
  ovulatoria: {
    name: "Ovulatoria", days: "14-16", color: "#C9A96E", icon: "○",
    energy: "máxima",
    training: "Pico de fuerza. Entrena con todo — este es TU momento de la semana.",
    nutrition: "Magnesio y zinc. Hidratación extra. Antioxidantes (berries, té verde).",
    mood: "Magnética, enérgica. Todo fluye con menos esfuerzo.",
  },
  lutea: {
    name: "Lútea", days: "17-28", color: "#B8806F", icon: "◒",
    energy: "media-baja",
    training: "Mantén volumen pero baja intensidad. Más repeticiones, menos peso. Más Pilates.",
    nutrition: "Carbohidratos complejos contra antojos. Triptófano (pavo, plátano) por la tarde.",
    mood: "Más sensible. Si hay ansiedad nocturna, será más fuerte esta fase.",
  },
  unknown: {
    name: "Observación", days: "?", color: "#9A8A82", icon: "◌",
    energy: "escucha tu cuerpo",
    training: "Entrena según cómo te sientas hoy. Registra tus síntomas para aprender tu patrón real.",
    nutrition: "Alimentación antiinflamatoria. Proteína en cada comida. Hidratación abundante.",
    mood: "Tu ciclo es único. Observa sin juzgar — tu cuerpo te está hablando.",
  },
};

// referenceDate: fecha desde la que se mide el día del ciclo. Default: hoy.
// Permite preguntar "qué fase era yo en la fecha X?" — usado por
// useAchievements para comprobar trainedInOvulation / restedInLuteal por sesión.
export function calcCyclePhase(lastPeriodDate, avgCycleLen = 28, cycleType = "regular", referenceDate = null) {
  if (!lastPeriodDate) return null;
  try {
    const last = new Date(lastPeriodDate + "T00:00:00");
    if (isNaN(last.getTime())) return null;
    const ref = referenceDate
      ? new Date(referenceDate + "T00:00:00")
      : new Date();
    if (isNaN(ref.getTime())) return null;
    ref.setHours(0, 0, 0, 0);
    const diffMs = ref - last;
    const diffDays = Math.floor(diffMs / 86400000) + 1;
    if (diffDays < 1) return null;

    if (cycleType === "irregular") {
      if (diffDays <= 5) {
        return {
          phase: "menstrual",
          dayOfCycle: diffDays,
          data: CYCLE_PHASES.menstrual,
          uncertain: false,
        };
      }
      return {
        phase: "unknown",
        dayOfCycle: diffDays,
        data: CYCLE_PHASES.unknown,
        uncertain: true,
      };
    }

    const dayOfCycle = ((diffDays - 1) % avgCycleLen) + 1;
    let phase;
    if (dayOfCycle <= 5) phase = "menstrual";
    else if (dayOfCycle <= 13) phase = "folicular";
    else if (dayOfCycle <= 16) phase = "ovulatoria";
    else phase = "lutea";
    return { phase, dayOfCycle, data: CYCLE_PHASES[phase], uncertain: false };
  } catch (e) {
    return null;
  }
}
