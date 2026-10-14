// Diario Oficial de la UE, serie L (legislación): reglamentos, directivas y decisiones nuevos.
// RSS predefinido de EUR-Lex «Acts of the Official Journal L» (rssId=222, sin clave). Solo trae las
// últimas ediciones, así que se acumula con la copia anterior. Reutilización libre citando la fuente
// (Decisión 2011/833/UE).
import type { EuLexDoc, EuLexType } from '../../src/lib/types.ts';
import { getText, type Source } from '../lib.ts';
import { parseFeed } from './news.ts';

export const FEED = 'https://eur-lex.europa.eu/EN/display-feed.rss?rssId=222';
const KEEP_DAYS = 30;
const MAX = 150;

/** Día en Madrid de una fecha ISO: el RSS da las 00:00 de Madrid, que en UTC aún es el día anterior. */
const madridDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

/** Tipo de acto según la letra del número CELEX del sector 3 (legislación): 32026R1753 → Reglamento. */
const TYPES: Record<string, EuLexType> = { R: 'Reglamento', L: 'Directiva', D: 'Decisión' };

/** Etiquetas por palabras del título (en inglés). Un acto puede llevar varias. */
export const TAGS: [string, RegExp][] = [
	['Sanciones', /restrictive measures|sanction/i],
	['Aranceles', /anti-dumping|countervailing|safeguard|customs dut|tariff/i],
	['Energía', /\benergy\b|\bgas\b|electricity|hydrogen|renewable/i],
	['Finanzas', /\bbank|financial|capital requirement|payment|securities|insurance/i],
	['Defensa', /defence|defense|military|security of supply/i],
	['Agricultura y pesca', /fishing|fisheries|agricultur|geographical indication|veterinar|plant protection/i],
	['Salud', /medicinal|health|pharmaceutical/i]
];

/** «CELEX:32026R1753: Commission Regulation…» → número CELEX y título. */
export function splitTitle(raw: string): { celex: string; title: string } | null {
	const m = raw.match(/^CELEX:\s*([0-9A-Z()]+):?\s*(.*)$/i);
	return m ? { celex: m[1].toUpperCase(), title: m[2].trim() } : null;
}

/** Los actos del RSS: sin correcciones de errores (CELEX acabado en R(01)…) ni actos sin título. */
export function parseL(body: string): EuLexDoc[] {
	return parseFeed(body, 'EUR-Lex').flatMap((item) => {
		const parts = splitTitle(item.title);
		if (!parts || !parts.title || /R\(\d+\)$/.test(parts.celex)) return [];
		const kind = parts.celex.match(/^3\d{4}([A-Z])/)?.[1] ?? '';
		return [
			{
				id: parts.celex,
				title: parts.title,
				type: TYPES[kind] ?? 'Otro',
				tags: TAGS.filter(([, re]) => re.test(parts.title)).map(([tag]) => tag),
				date: item.time ? madridDay(item.time) : '',
				url: `https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:${parts.celex}`
			}
		];
	});
}

/** Junta lo nuevo con lo guardado: sin repetir, lo más reciente primero y solo los últimos días. */
export function accumulate(fresh: EuLexDoc[], previous: EuLexDoc[] = [], today = new Date().toISOString().slice(0, 10)): EuLexDoc[] {
	const from = new Date(Date.parse(today) - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
	const seen = new Set<string>();
	return [...fresh, ...previous]
		.filter((d) => d.date >= from && !seen.has(d.id) && !!seen.add(d.id))
		.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
		.slice(0, MAX);
}

export const eurlex: Source<EuLexDoc[]> = {
	name: 'eurlex',
	label: 'Diario Oficial de la UE, serie L · EUR-Lex',
	maxAgeMinutes: 60,
	async fetch(previous) {
		const fresh = parseL(await getText(FEED));
		if (!fresh.length && !previous?.length) throw new Error('el RSS de la serie L no trae actos');
		return accumulate(fresh, previous ?? []);
	}
};
