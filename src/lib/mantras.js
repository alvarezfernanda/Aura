export const DAILY_MANTRAS = [
  "El cuerpo recuerda lo que la mente olvida.",
  "Constancia. No perfección.",
  "Tu ritmo es tu ventaja.",
  "Lo pequeño, repetido, se vuelve grande.",
  "Escuchar también es entrenar.",
  "La fuerza se construye despacio.",
  "Habita tu cuerpo sin prisa.",
  "Hoy es un buen día para ti.",
  "Cada repetición te devuelve algo.",
  "La calma también es disciplina.",
];

export const getMantraOfDay = () => {
  const day = Math.floor(Date.now() / 86400000);
  return DAILY_MANTRAS[day % DAILY_MANTRAS.length];
};

export function getSeasonalMantra(seasonInfo) {
  if (!seasonInfo || !seasonInfo.mantras) {
    return getMantraOfDay();
  }
  const day = Math.floor(Date.now() / 86400000);
  return seasonInfo.mantras[day % seasonInfo.mantras.length];
}
