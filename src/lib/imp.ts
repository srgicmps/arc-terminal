// Lo más importante (IMP): lectura de static/data/imp.json. La puntuación se calcula en
// scripts/sources/imp.ts; aquí solo se elige y se suma lo guardado.
import type { ImpData, ImpEntry } from './types.ts';

/** Un tema sumado en varios días. */
export interface ImpTotal extends ImpEntry {
	/** Días en que estuvo en el top. */
	days: number;
	/** Último día en que salió: «2026-10-14». */
	last: string;
}

/**
 * Lo más importante de hoy (para la vista IMP y el módulo «Lo importante» de TOP): lo máximo que alcanzó
 * cada tema a lo largo del día. Si aún no hay histórico de hoy, el top de ahora mismo.
 */
export function topImportant(data: ImpData | null | undefined, n = 5): ImpEntry[] {
	if (!data) return [];
	const today = data.days.find((d) => d.date === data.date);
	return (today?.items ?? data.current).slice(0, n);
}

/** «2026-10-14» menos `days` días de calendario. */
export function minus(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

/**
 * Suma el histórico diario de los `span` días que acaban en `end` (incluido): un tema que estuvo varios
 * días suma la puntuación de cada uno. Se desduplica por la clave del tema y se queda con el titular del
 * día en que más puntuó. Empates: más días y, después, más reciente.
 */
export function aggregate(days: ImpData['days'], end: string, span: number, n = 10): ImpTotal[] {
	const from = minus(end, span - 1);
	const totals = new Map<string, ImpTotal & { best: number }>();
	for (const day of days) {
		if (day.date < from || day.date > end) continue;
		for (const e of day.items) {
			const t = totals.get(e.k);
			if (!t) {
				totals.set(e.k, { ...e, sources: [...e.sources], sections: [...(e.sections ?? [])], days: 1, last: day.date, best: e.score });
				continue;
			}
			t.score += e.score;
			t.days++;
			if (day.date > t.last) t.last = day.date;
			for (const s of e.sources) if (!t.sources.includes(s)) t.sources.push(s);
			for (const s of e.sections ?? []) if (!t.sections!.includes(s)) t.sections!.push(s);
			if (e.score > t.best) Object.assign(t, { title: e.title, lang: e.lang, titleEs: e.titleEs, url: e.url, best: e.score });
		}
	}
	return [...totals.values()]
		.map(({ best: _, ...t }) => ({ ...t, score: Math.round(t.score * 10) / 10 }))
		.sort((a, b) => b.score - a.score || b.days - a.days || b.last.localeCompare(a.last))
		.slice(0, n);
}

/** Periodos de la vista IMP: cuántos días hacia atrás desde hoy. */
export const IMP_PERIODS = [
	{ key: 'day', label: 'Hoy', span: 1 },
	{ key: 'week', label: 'Semana', span: 7 },
	{ key: 'month', label: 'Mes', span: 30 },
	{ key: 'year', label: 'Año', span: 365 }
] as const;

/** Filtro por sección de la vista IMP: TECH e IA van juntas; Gobiernos y Organismos, solo en «Todo». */
export const IMP_GROUPS = [
	{ key: 'all', label: 'Todo', sections: [] },
	{ key: 'eco', label: 'ECO', sections: ['eco'] },
	{ key: 'geo', label: 'GEO', sections: ['geo'] },
	{ key: 'es', label: 'ES', sections: ['es'] },
	{ key: 'ws', label: 'WS', sections: ['ws'] },
	{ key: 'tech', label: 'TECH·IA', sections: ['tech', 'ai'] }
] as const;

export type ImpGroup = (typeof IMP_GROUPS)[number]['key'];

/**
 * Los `n` primeros temas del grupo de secciones `group` («all»: todos). `sectionsOf` da las secciones de
 * cada tema (las guardadas o, en los temas de antes de M9, las del top de ahora). Sin repetir tema.
 */
export function inGroup<T extends ImpEntry>(items: T[], group: ImpGroup, sectionsOf: (item: T) => string[], n: number): T[] {
	const wanted: readonly string[] = IMP_GROUPS.find((g) => g.key === group)?.sections ?? [];
	const seen = new Set<string>();
	return items
		.filter((i) => !seen.has(i.k) && !!seen.add(i.k))
		.filter((i) => !wanted.length || sectionsOf(i).some((s) => wanted.includes(s)))
		.slice(0, n);
}

