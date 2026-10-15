// BOE: utilidades de la vista para la semana (static/data/boe-week.json, ver scripts/sources/boe.ts).
import type { BoeData, BoeWeek, BoeWeekDay } from './types.ts';
import { watched } from './watchwords.ts';

/** Enlace de una disposición a partir de su id: «BOE-A-2026-1» → su página en boe.es. */
export const boeHtml = (id: string) => `https://www.boe.es/diario_boe/txt.php?id=${encodeURIComponent(id)}`;

/** Un día de la semana en la forma del sumario de hoy (sin PDF), para usar las mismas funciones. */
export function dayData(day: BoeWeekDay): BoeData {
	return {
		date: day.date,
		number: day.number,
		pdf: '',
		sections: day.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, html: boeHtml(i.id), pdf: '' })) }))
	};
}

/**
 * Cuántas disposiciones del último sumario de la semana nombran alguna palabra vigilada (para TOP).
 * `date` es la de ese sumario, que puede no ser hoy (domingos, o antes de las 7:30).
 */
export function latestWatched(week: BoeWeek | null, words: string[]): { date: string; count: number } | null {
	const day = week?.days[0];
	if (!day || !words.length) return null;
	return { date: day.date, count: watched(dayData(day), words).length };
}
