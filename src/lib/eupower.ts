// Precio de la luz en Europa (static/data/energycharts.json): comparar países con la media.
import type { EuPowerZone } from './types.ts';

export type PowerDay = 'today' | 'tomorrow';

/** Media simple de las zonas con precio ese día (cada zona cuenta una vez), en €/MWh. Null si no hay ninguna. */
export function europeAverage(zones: EuPowerZone[], day: PowerDay): number | null {
	const values = zones.map((z) => z[day]).filter((v): v is number => v !== null);
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Cuánto más cara (+) o más barata (−) está una zona que la media, en €/MWh y en %. */
export function vsAverage(zones: EuPowerZone[], zone: string, day: PowerDay): { diff: number; pct: number } | null {
	const avg = europeAverage(zones, day);
	const v = zones.find((z) => z.zone === zone)?.[day];
	if (avg === null || v === null || v === undefined || !avg) return null;
	return { diff: v - avg, pct: ((v - avg) / avg) * 100 };
}

/** Las zonas de un país (Alemania → DE-LU; Italia → IT-North), para la ficha PAIS. */
export function zonesOf(zones: EuPowerZone[], country: string): EuPowerZone[] {
	return zones.filter((z) => z.country === country);
}
