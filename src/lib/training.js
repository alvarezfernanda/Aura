// Sugiere peso para el próximo set basándose en historial, energía y fase del ciclo.
// Resultado: { suggested: number, source: "base" | "aprendido", message: string }
export function suggestWeight(exercise, history, energy, cyclePhase = null) {
  const base = exercise.baseWeight;
  if (!history || history.length === 0) {
    return { suggested: base, source: "base", message: "Sugerencia inicial. Ajusta según sientas." };
  }
  const last = history[history.length - 1];
  const lastAvgWeight = last.sets.reduce((s, x) => s + (x.weight || 0), 0) / (last.sets.length || 1);

  let multiplier = 1;
  let rationale = "";
  if (energy === "alta") {
    const avgRir = last.sets.reduce((s, x) => s + (parseInt(x.rir) || 0), 0) / last.sets.length;
    if (avgRir >= 2) { multiplier = 1.05; rationale = "Tu cuerpo está listo. Subimos 5%."; }
    else { multiplier = 1.02; rationale = "Alta energía, último RIR apretado. Subimos poco."; }
  } else if (energy === "media") {
    multiplier = 1; rationale = "Mantén el peso. Consolida técnica.";
  } else {
    multiplier = 0.88; rationale = "Baja energía. Bajamos 12%.";
  }

  let cycleNote = "";
  if (cyclePhase === "ovulatoria") { multiplier *= 1.03; cycleNote = " Fase ovulatoria — pico."; }
  else if (cyclePhase === "folicular") { cycleNote = " Folicular — receptiva."; }
  else if (cyclePhase === "lutea") { multiplier *= 0.95; cycleNote = " Lútea — bajamos ligero."; }
  else if (cyclePhase === "menstrual") { multiplier *= 0.85; cycleNote = " Menstrual — escucha tu cuerpo."; }

  const suggested = Math.round(lastAvgWeight * multiplier * 2) / 2;
  return { suggested, source: "aprendido", message: rationale + cycleNote };
}
