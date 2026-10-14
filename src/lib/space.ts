// Tormentas solares (NOAA SWPC): de los datos guardados, qué nivel de tormenta geomagnética hay o se
// espera. Funciones puras: las usan las vistas (avisos en WX y GEO, línea en STATUS) y podrá usarlas la
// alerta por ntfy.
import type { SwpcData } from './types.ts';

/** Escala G de la NOAA (https://www.swpc.noaa.gov/noaa-scales-explanation). */
export const G_LABEL = ['sin tormenta', 'menor', 'moderada', 'fuerte', 'severa', 'extrema'];

/** Kp → escala G equivalente (Kp 5 = G1 … Kp 9 = G5). */
export const gFromKp = (kp: number | null | undefined): number =>
	typeof kp === 'number' && Number.isFinite(kp) ? Math.max(0, Math.min(5, Math.floor(kp) - 4)) : 0;

export interface StormLevel {
	/** El nivel G más alto entre el actual y el previsto (0–5). */
	level: number;
	/** Nivel G ahora: el de la NOAA o, si no lo da, el que corresponde al Kp. */
	now: number;
	/** Nivel G más alto previsto para los próximos días, y qué día (AAAA-MM-DD). */
	forecast: number;
	forecastDate: string | null;
	/** ¿El nivel más alto es el previsto (y no el actual)? */
	upcoming: boolean;
}

/** Nivel de tormenta geomagnética de unos datos de SWPC; null si no hay datos. */
export function stormLevel(data: SwpcData | null | undefined): StormLevel | null {
	if (!data) return null;
	const now = Math.max(data.g ?? 0, gFromKp(data.kp));
	const forecast = data.gForecast ?? 0;
	return {
		level: Math.max(now, forecast),
		now,
		forecast,
		forecastDate: data.gForecastDate,
		upcoming: forecast > now
	};
}
