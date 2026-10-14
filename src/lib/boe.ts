// BOE: utilidades de la vista para la semana (static/data/boe-week.json, ver scripts/sources/boe.ts).
import type { BoeData, BoeWeekDay } from './types.ts';

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
