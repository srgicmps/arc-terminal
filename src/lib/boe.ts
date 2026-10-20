// BOE: utilidades de la vista para la semana (static/data/boe-week.json, ver scripts/sources/boe.ts)
// y el recorte del último sumario con el que TOP cuenta las palabras vigiladas (data/boe-hoy.json).
import type { BoeData, BoeWeekDay, BoeWeekItem } from './types.ts';
import { matches } from './watchwords.ts';

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
 * Lo justo del último sumario para contar las palabras vigiladas en TOP: su fecha y, de cada disposición,
 * el texto en el que se buscan. Lo genera src/routes/data/boe-hoy.json al construir la web.
 */
export interface BoeToday {
	/** «2026-10-20» */
	date: string;
	texts: string[];
}

/** Título, ministerio y epígrafe juntos: el mismo texto en el que busca `watched()` (watchwords.ts). */
const watchText = (i: BoeWeekItem) => `${i.title} ${i.dept} ${i.epigraph}`;

/** El recorte de un sumario: sin enlaces, ids ni secciones. */
export function boeToday(boe: BoeData): BoeToday {
	return { date: boe.date, texts: boe.sections.flatMap((s) => s.items.map(watchText)) };
}

/**
 * Cuántas disposiciones del último sumario nombran alguna palabra vigilada (para TOP).
 * `date` es la de ese sumario, que puede no ser hoy (domingos, o antes de las 7:30).
 */
export function latestWatched(today: BoeToday | null, words: string[]): { date: string; count: number } | null {
	if (!today || !words.length) return null;
	return { date: today.date, count: today.texts.filter((t) => matches(t, words).length).length };
}
