// Predicciones (experiencia 8): las rondas del juego. Fuente derivada (`after`): no descarga nada, usa el
// calendario de publicaciones (releases-cal), las reuniones del BCE (src/lib/meetings.ts) y las series de
// esta misma pasada. Recibe la copia anterior para que cada ronda guarde su dato de partida; las reglas,
// en src/lib/exp/forecasts.ts. Las apuestas no están aquí (son de cada usuario): van en D1 (cloud/forecasts.ts).
import { GAMES, updateRounds, type ForecastData } from '../../src/lib/exp/forecasts.ts';
import { catalogOf, extract } from '../../src/lib/gseries.ts';
import { MEETINGS } from '../../src/lib/meetings.ts';
import type { Point, ReleaseCalData } from '../../src/lib/types.ts';
import { NO_CONTEXT, type Source } from '../lib.ts';

/** Archivos de static/data donde están las series del juego. */
const FILES = ['ine', 'bls', 'eurostat', 'ecb'];

export const forecasts: Source<ForecastData> = {
	name: 'forecasts',
	label: 'Rondas del juego de predicciones · calendario de publicaciones y series de la terminal',
	maxAgeMinutes: 55,
	after: true,
	async fetch(previous, ctx = NO_CONTEXT) {
		const wanted = new Set(GAMES.map((g) => g.series));
		const series: Record<string, Point[]> = {};
		for (const ds of FILES) {
			const data = ctx.get(ds);
			for (const entry of catalogOf(ds, data)) if (wanted.has(entry.id)) series[entry.id] = extract(data, entry);
		}
		if (!Object.keys(series).length) throw new Error('sin series en esta pasada');
		const events = [
			...(ctx.get<ReleaseCalData>('releases-cal')?.events ?? []).flatMap((e) => (e.topic ? [{ topic: e.topic, closes: e.date }] : [])),
			// El BCE anuncia a las 14:15 de Madrid: se deja de apostar a las 12:00 UTC (13:00 o 14:00 en Madrid).
			...MEETINGS.filter((m) => m.bank === 'ecb').map((m) => ({ topic: 'ecb', closes: `${m.date}T12:00:00Z` }))
		];
		return { rounds: updateRounds(previous?.rounds ?? [], events, series, Date.now()) };
	}
};
