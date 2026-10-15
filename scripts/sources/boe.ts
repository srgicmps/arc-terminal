// Sumario del Boletín Oficial del Estado: API de datos abiertos del BOE (sin clave).
// https://www.boe.es/datosabiertos/ · Reutilización libre citando la fuente.
// Además de boe.json (el último sumario), dos archivos extra con los últimos 7 días:
//   - boe-week.json: los sumarios, sin enlaces (salen del id), para la pestaña «Semana» de BOE.
// Van aparte, y no dentro de boe.json, porque TOP y ES pasan boe.json al navegador casi entero.
// Los días ya guardados se leen de la copia publicada; solo se piden al BOE los que falten.
import type { BoeData, BoeItem, BoeSection, BoeWeek, BoeWeekDay } from '../../src/lib/types.ts';
import { fetchPublished, list, madridDate, plain, request, writeExtra, type Source } from '../lib.ts';

const API = 'https://www.boe.es/datosabiertos/api/boe/sumario';

// Las secciones IV (Administración de Justicia) y V (anuncios) traen cientos de edictos y licitaciones:
// de ellas solo se guardan las primeras.
const CAPPED = /^(4|5)/;
const CAP = 15;

type Raw = Record<string, any>;

function url(value: unknown): string {
	let text = '';
	if (typeof value === 'string') text = value;
	else if (value && typeof value === 'object' && 'texto' in value) text = String((value as Raw).texto);
	if (!text) return '';
	return text.startsWith('http') ? text : new URL(text, 'https://www.boe.es/').href;
}

function toItem(raw: Raw, dept: string, epigraph: string): BoeItem {
	return {
		id: String(raw.identificador ?? ''),
		title: plain(raw.titulo, 800),
		dept,
		epigraph,
		html: url(raw.url_html),
		pdf: url(raw.url_pdf)
	};
}

function toSection(raw: Raw): BoeSection {
	const items: BoeItem[] = [];
	for (const dep of list<Raw>(raw.departamento)) {
		const dept = plain(dep.nombre);
		for (const item of list<Raw>(dep.item)) items.push(toItem(item, dept, ''));
		for (const epi of list<Raw>(dep.epigrafe)) {
			for (const item of list<Raw>(epi.item)) items.push(toItem(item, dept, plain(epi.nombre)));
		}
	}
	const code = String(raw.codigo ?? '');
	return {
		code,
		name: plain(raw.nombre),
		total: items.length,
		items: CAPPED.test(code) ? items.slice(0, CAP) : items
	};
}

/** «20261014» → «2026-10-14». */
const iso = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;

/** El sumario de un día («20261014»), o null si ese día no hay BOE (domingos) o no responde. */
async function sumario(day: string): Promise<BoeData | null> {
	const res = await request(`${API}/${day}`, { headers: { Accept: 'application/json' } }, 1).catch(() => null);
	if (!res) return null;
	const body = (await res.json()) as Raw;
	const diario = list<Raw>(body?.data?.sumario?.diario)[0];
	if (!diario) return null;
	return {
		date: iso(day),
		number: String(diario.numero ?? ''),
		pdf: url(diario.sumario_diario?.url_pdf),
		sections: list<Raw>(diario.seccion).map(toSection)
	};
}

/** Un sumario en la forma compacta de la semana: sin enlaces ni PDF. */
export function compact(data: BoeData): BoeWeekDay {
	return {
		date: data.date,
		number: data.number,
		sections: data.sections.map(({ code, name, total, items }) => ({
			code,
			name,
			total,
			items: items.map(({ id, title, dept, epigraph }) => ({ id, title, dept, epigraph }))
		}))
	};
}

export const WEEK_DAYS = 7;

/**
 * Los sumarios de los últimos 7 días de calendario que acaban en `latest` (el de hoy o el último que
 * haya): los guardados se reutilizan y los que falten se piden con `load` (null si ese día no hay BOE).
 */
export async function buildWeek(
	latest: BoeData,
	saved: BoeWeekDay[],
	load: (day: string) => Promise<BoeData | null>,
	today = madridDate(0)
): Promise<BoeWeek> {
	const days: BoeWeekDay[] = [];
	for (let offset = 0; offset > -WEEK_DAYS; offset--) {
		const day = shift(today, offset);
		const date = iso(day);
		if (date === latest.date) days.push(compact(latest));
		else {
			const kept = saved.find((d) => d.date === date);
			const fresh = kept ? null : await load(day);
			if (kept) days.push(kept);
			else if (fresh) days.push(compact(fresh));
		}
	}
	return { days };
}

/** «20261014» más `n` días de calendario. */
function shift(day: string, n: number): string {
	return new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8) + n)).toISOString().slice(0, 10).replaceAll('-', '');
}

/** La semana publicada; si no se puede leer, vacía (y se piden al BOE los días que falten). */
async function publishedWeek(): Promise<BoeWeekDay[]> {
	try {
		const res = await fetchPublished('boe-week.json');
		if (!res?.ok) throw new Error(res ? `HTTP ${res.status}` : 'sin respuesta');
		return list<BoeWeekDay>(((await res.json()) as BoeWeek).days);
	} catch (error) {
		console.log(`  boe · semana publicada: ${error instanceof Error ? error.message : error}`);
		return [];
	}
}

export const boe: Source<BoeData> = {
	name: 'boe',
	label: 'Sumario del BOE · Agencia Estatal Boletín Oficial del Estado',
	maxAgeMinutes: 25,
	files: () => ['boe-week.json'],
	async fetch() {
		// El BOE sale de lunes a sábado hacia las 7:30. Si hoy aún no hay, se busca el anterior.
		for (let offset = 0; offset >= -7; offset--) {
			const latest = await sumario(madridDate(offset));
			if (!latest) continue;
			const week = await buildWeek(latest, await publishedWeek(), sumario);
			await writeExtra('boe-week.json', week);
			const kb = (x: unknown) => Math.round(Buffer.byteLength(JSON.stringify(x)) / 1024);
			console.log(`  boe · semana: ${week.days.length} sumarios, ${kb(week)} KB`);
			return latest;
		}
		throw new Error('no hay sumario del BOE en los últimos 7 días');
	}
};
