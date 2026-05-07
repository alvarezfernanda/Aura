// Detección de ventana fértil basada en signos cervicales y libido.
export function detectFertileWindow(symptoms, lastPeriod) {
  if (!symptoms || typeof symptoms !== "object") return null;
  const entries = Object.entries(symptoms)
    .filter(([date, _data]) => {
      if (!lastPeriod) return true;
      return date >= lastPeriod;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length < 2) return null;

  const eggWhiteDays = entries.filter(([_, d]) => d.mucus === "eggwhite").map(([date]) => date);
  const ovaryPainDays = entries.filter(([_, d]) =>
    (d.symptoms || []).includes("cm_ovul")
  ).map(([date]) => date);
  const libidoDays = entries.filter(([_, d]) =>
    (d.symptoms || []).includes("libido")
  ).map(([date]) => date);

  if (eggWhiteDays.length === 0 && ovaryPainDays.length === 0) return null;

  let confidence = "baja";
  let signal = null;

  if (eggWhiteDays.length >= 2) {
    confidence = "alta";
    signal = "Moco cervical elástico detectado";
  } else if (eggWhiteDays.length >= 1 && ovaryPainDays.length >= 1) {
    confidence = "alta";
    signal = "Moco elástico + dolor ovárico";
  } else if (eggWhiteDays.length >= 1) {
    confidence = "media";
    signal = "Moco cervical elástico";
  } else if (ovaryPainDays.length >= 1) {
    confidence = "media";
    signal = "Dolor ovárico detectado";
  }

  const lastEggWhite = eggWhiteDays[eggWhiteDays.length - 1];
  const firstEggWhite = eggWhiteDays[0];

  return {
    confidence,
    signal,
    fertileStart: firstEggWhite || ovaryPainDays[0],
    fertileEnd: lastEggWhite || ovaryPainDays[ovaryPainDays.length - 1],
    hasLibido: libidoDays.length > 0,
  };
}

// Detecta patrones simples (cólicos frecuentes, baja energía, irritabilidad, variabilidad).
export function detectPatterns(symptoms, cycleHistory) {
  if (!symptoms || typeof symptoms !== "object") return [];
  const insights = [];

  const allDays = Object.entries(symptoms);
  if (allDays.length < 7) return [];

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const last30DaysStr = last30Days.toISOString().slice(0, 10);

  const recentDays = allDays.filter(([date]) => date >= last30DaysStr);
  const crampsDays = recentDays.filter(([_, d]) => (d.symptoms || []).includes("cramps")).length;
  const lowEnergyDays = recentDays.filter(([_, d]) => (d.symptoms || []).includes("low_energy")).length;
  const moodDays = recentDays.filter(([_, d]) => (d.symptoms || []).includes("mood")).length;

  if (crampsDays >= 5) {
    insights.push({
      type: "warning",
      text: `Has tenido cólicos ${crampsDays} días este último mes. Si es constante, vale la pena mencionarlo a tu ginecóloga.`,
    });
  }

  if (lowEnergyDays >= 10) {
    insights.push({
      type: "info",
      text: `${lowEnergyDays} días de cansancio en el mes. Revisa sueño, hierro y tiroides con tu médica.`,
    });
  }

  if (moodDays >= 7) {
    insights.push({
      type: "info",
      text: `Irritabilidad frecuente (${moodDays} días). Podría ser hormonal, estrés o SPM — observa si coincide con fases.`,
    });
  }

  if (Array.isArray(cycleHistory) && cycleHistory.length >= 3) {
    const sorted = [...cycleHistory].sort();
    const diffs = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1] + "T00:00:00");
      const d2 = new Date(sorted[i] + "T00:00:00");
      const diff = Math.floor((d2 - d1) / 86400000);
      if (diff > 10 && diff < 90) diffs.push(diff);
    }
    if (diffs.length >= 2) {
      const variation = Math.max(...diffs) - Math.min(...diffs);
      if (variation > 20) {
        insights.push({
          type: "warning",
          text: `Tu ciclo varía ${variation} días entre el más corto y el más largo. Es una variación alta — vale la pena evaluar con profesional.`,
        });
      }
    }
  }

  return insights;
}
