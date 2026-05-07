import { useState, useEffect } from "react";

// Hook que consulta Open-Meteo (gratis, sin API key) y devuelve el estado
// del tiempo simplificado: { temp, humidity, code } o null si aún no llegó
// (o si falló la red — falla silenciosa para no interrumpir la app).
export function useWeather(lat = -17.783, lon = -63.182) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled && data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            humidity: data.current.relative_humidity_2m,
            code: data.current.weather_code,
          });
        }
      } catch (e) {
        // silencio
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return weather;
}
