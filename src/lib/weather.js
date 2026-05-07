// Decodifica WMO weather codes a categoría simple
export function decodeWeather(code) {
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
export function getWeatherSuggestion(weather, dayOfWeek) {
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
