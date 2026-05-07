// Utilidades de fechas — extraídas de App.jsx para testeo aislado.

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const weekKey = (d = new Date()) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const firstJan = new Date(year, 0, 1);
  const days = Math.floor((date - firstJan) / 86400000);
  const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

export const monthKey = (d = new Date()) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const DAY_OF_WEEK = () => {
  const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const idx = new Date().getDay();
  return days[idx === 0 ? 6 : idx - 1];
};

export const isNightTime = () => {
  const h = new Date().getHours();
  return h >= 20 || h < 6;
};
