import { useState } from "react";

export const COACH_SYSTEM = `Eres la coach personal de Fer en Aura.
Contexto: 156 cm, 70 kg, meta -10 kg. Glúteos/pierna fuerte. Valgus, cuello adelantado.
Dieta gluten-free. 3 gym + Pilates. Ansiedad nocturna.
Estilo: cálido, directo, español. 3-5 frases. Sin emojis. Voz editorial.`;

// Hook que envuelve el endpoint /api/claude. Devuelve { ask, loading }.
// ask(prompt, systemContext?) → Promise<string | null>
// Filtra los content blocks de tipo "text" y los une con saltos de línea.
// En caso de error de red o parseo retorna null.
export function useClaudeCoach() {
  const [loading, setLoading] = useState(false);
  const ask = async (prompt, systemContext = COACH_SYSTEM) => {
    setLoading(true);
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemContext,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      setLoading(false);
      return (
        data.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n") || ""
      );
    } catch (e) {
      setLoading(false);
      return null;
    }
  };
  return { ask, loading };
}
