// Sanciones del Reino Unido: lo que publica la OFSI (Office of Financial Sanctions Implementation, del
// Tesoro británico) en GOV.UK: avisos de designaciones, licencias generales y multas. API de búsqueda pública
// de GOV.UK, sin clave. Contenido bajo la Open Government Licence v3.0 (reutilización libre citando la fuente).
// Solo da lo último, así que se acumula con la copia anterior (30 días).
import type { TradeDoc } from '../../src/lib/types.ts';
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export const OFSI_URL =
	'https://www.gov.uk/api/search.json?filter_organisations=office-of-financial-sanctions-implementation' +
	'&count=40&order=-public_timestamp&fields=title,link,description,public_timestamp,content_store_document_type';

const KEEP_DAYS = 30;
const MAX = 60;

/** Día en Madrid de una fecha ISO. */
const madridDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

/** Tipo de documento de GOV.UK, en español. */
const TYPES: Record<string, string> = {
	notice: 'Aviso',
	document_collection: 'Colección',
	guidance: 'Guía',
	news_story: 'Noticia',
	press_release: 'Comunicado',
	policy_paper: 'Documento',
	transparency: 'Transparencia',
	statutory_guidance: 'Guía'
};

export function parseOfsi(body: Raw): TradeDoc[] {
	return list<Raw>(body?.results)
		.map((r): TradeDoc | null => {
			const link = typeof r?.link === 'string' ? r.link : '';
			const title = plain(r?.title, 300);
			const t = Date.parse(r?.public_timestamp ?? '');
			if (!link || !title || !Number.isFinite(t)) return null;
			const url = link.startsWith('http') ? link : `https://www.gov.uk${link}`;
			return {
				id: `ofsi:${link}`,
				title,
				type: TYPES[String(r?.content_store_document_type ?? '')] ?? '',
				subtype: '',
				abstract: plain(r?.description, 300),
				agencies: ['OFSI'],
				date: madridDay(new Date(t).toISOString()),
				url,
				pdf: '',
				agency: 'OFSI',
				topic: 'Sanciones'
			};
		})
		.filter((d): d is TradeDoc => d !== null);
}

/** Junta lo nuevo con lo anterior sin repetir, de lo más reciente a lo más antiguo, y quita lo de hace más de 30 días. */
export function accumulate(fresh: TradeDoc[], previous: TradeDoc[], now = Date.now()): TradeDoc[] {
	const since = madridDay(new Date(now - KEEP_DAYS * 86_400_000).toISOString());
	const byId = new Map<string, TradeDoc>();
	for (const d of [...fresh, ...previous]) if (!byId.has(d.id) && d.date >= since) byId.set(d.id, d);
	return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX);
}

export const sanctionsUk: Source<TradeDoc[]> = {
	name: 'sanctions-uk',
	label: 'Sanciones del Reino Unido · OFSI (GOV.UK)',
	maxAgeMinutes: 60,
	allowEmpty: true,
	async fetch(previous) {
		return accumulate(parseOfsi(await getJson<Raw>(OFSI_URL)), previous ?? []);
	}
};
