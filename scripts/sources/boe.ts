// Sumario del Boletín Oficial del Estado: API de datos abiertos del BOE (sin clave).
// https://www.boe.es/datosabiertos/ · Reutilización libre citando la fuente.
import type { BoeData, BoeItem, BoeSection } from '../../src/lib/types.ts';
import { list, madridDate, plain, request, type Source } from '../lib.ts';

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

export const boe: Source<BoeData> = {
	name: 'boe',
	label: 'Sumario del BOE · Agencia Estatal Boletín Oficial del Estado',
	maxAgeMinutes: 25,
	async fetch() {
		// El BOE sale de lunes a sábado hacia las 7:30. Si hoy aún no hay, se busca el anterior.
		for (let offset = 0; offset >= -7; offset--) {
			const day = madridDate(offset);
			const res = await request(`${API}/${day}`, { headers: { Accept: 'application/json' } }, 1).catch(
				() => null
			);
			if (!res) continue;
			const body = (await res.json()) as Raw;
			const sumario = body?.data?.sumario;
			const diario = list<Raw>(sumario?.diario)[0];
			if (!diario) continue;
			return {
				date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
				number: String(diario.numero ?? ''),
				pdf: url(diario.sumario_diario?.url_pdf),
				sections: list<Raw>(diario.seccion).map(toSection)
			};
		}
		throw new Error('no hay sumario del BOE en los últimos 7 días');
	}
};
