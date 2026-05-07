import { DAY_OF_WEEK } from "./dates.js";

export function getContextualGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function getDayMessage() {
  const day = DAY_OF_WEEK();
  const messages = {
    lunes: "Hoy tocan glúteos y hombros. Empieza con intención.",
    martes: "Pilates o descanso activo. Tu cuerpo lo agradece.",
    miercoles: "Hoy es miércoles de espalda. Tu cuello te lo agradecerá.",
    jueves: "Pilates o descanso. Día perfecto para cuello.",
    viernes: "Pierna y glúteo. Termina fuerte.",
    sabado: "Día libre o Pilates suave. Recupera.",
    domingo: "Descanso. Prepárate para la semana.",
  };
  return messages[day];
}
