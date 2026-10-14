// Alertas naranjas y rojas de catástrofes según GDACS (https://www.gdacs.org), el sistema de alertas de
// desastres de la ONU y la Comisión Europea: terremotos, ciclones, inundaciones, volcanes, sequías e
// incendios. API pública y sin clave (GeoJSON). Términos: datos de uso libre citando a GDACS; no
// publican un límite por IP, así que se pide como mucho cada 30 min. Las fechas de la API van en UTC
// sin zona («2026-10-10T08:12:00»).
import { getJson, list, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export type GdacsType = 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF';

export interface GdacsEvent {
	/** Tipo y número de evento de GDACS, p. ej. «EQ1501234». Estable entre episodios. */
	id: string;
	type: GdacsType;
	/** Nombre del tipo en español. */
	kind: string;
	level: 'orange' | 'red';
	name: string;
	country: string;
	/** Fecha de inicio, fin y última actualización, en ISO (UTC). */
	from: string | null;
	to: string | null;
	updated: string | null;
	/** Texto de gravedad de GDACS, p. ej. «Magnitude 7.1M, Depth:10km». */
	severity: string;
	/** Puntuación de alerta de GDACS (0–3 aprox.): sirve para ordenar dentro de un mismo nivel. */
	score: number | null;
	lat: number | null;
	lon: number | null;
	url: string;
}

const KINDS: Record<GdacsType, string> = {
	EQ: 'Terremoto',
	TC: 'Ciclón tropical',
	FL: 'Inundación',
	VO: 'Volcán',
	DR: 'Sequía',
	WF: 'Incendio forestal'
};

/** Días hacia atrás que se piden; luego solo se quedan los vigentes o los de la última semana. */
const DAYS = 30;
const RECENT_MS = 7 * 86_400_000;

export const gdacsUrl = (now = Date.now()) => {
	const day = (t: number) => new Date(t).toISOString().slice(0, 10);
	return (
		'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;DR;WF' +
		`&alertlevel=Orange;Red&fromdate=${day(now - DAYS * 86_400_000)}&todate=${day(now + 86_400_000)}`
	);
};

/** Fecha de GDACS (UTC, a veces sin zona) a ISO; null si no se entiende. */
export function gdacsDate(value: unknown): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	const s = value.trim();
	const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Convierte el GeoJSON de GDACS en nuestra lista: solo naranjas y rojas, vigentes o recientes. */
export function parseGdacs(body: Raw, now = Date.now()): GdacsEvent[] {
	const seen = new Set<string>();
	return list<Raw>(body?.features)
		.map((feature): GdacsEvent | null => {
			const p = feature?.properties ?? {};
			const type = String(p.eventtype ?? '').toUpperCase() as GdacsType;
			const level = String(p.alertlevel ?? '').toLowerCase();
			if (!(type in KINDS) || (level !== 'orange' && level !== 'red') || !p.eventid) return null;
			const id = `${type}${p.eventid}`;
			const to = gdacsDate(p.todate);
			const current = String(p.iscurrent).toLowerCase() === 'true';
			if (!current && (!to || now - Date.parse(to) > RECENT_MS)) return null;
			const [lon, lat] = list<unknown>(feature?.geometry?.coordinates);
			return {
				id,
				type,
				kind: KINDS[type],
				level,
				name: plain(p.name || p.eventname || p.description, 200),
				country: plain(p.country || list<Raw>(p.affectedcountries).map((c) => c?.countryname).filter(Boolean).join(', '), 120),
				from: gdacsDate(p.fromdate),
				to,
				updated: gdacsDate(p.datemodified) ?? to,
				severity: plain(p.severitydata?.severitytext, 160),
				score: num(p.alertscore),
				lat: num(lat),
				lon: num(lon),
				// A veces el enlace viene como «no reportlink found».
				url: /^https?:\/\//.test(String(p.url?.report))
					? String(p.url.report)
					: `https://www.gdacs.org/report.aspx?eventtype=${type}&eventid=${encodeURIComponent(p.eventid)}`
			};
		})
		.filter((e): e is GdacsEvent => e !== null)
		// Un evento sale una vez por episodio: nos quedamos con el más reciente. Luego, rojas primero.
		.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))
		.filter((e) => !seen.has(e.id) && Boolean(seen.add(e.id)))
		.sort((a, b) => (a.level === b.level ? 0 : a.level === 'red' ? -1 : 1));
}

export const gdacs: Source<GdacsEvent[]> = {
	name: 'gdacs',
	label: 'Alertas de catástrofes (naranjas y rojas) · GDACS (ONU y Comisión Europea)',
	maxAgeMinutes: 30,
	// Puede no haber ninguna alerta naranja o roja vigente: es buena noticia, no un fallo.
	allowEmpty: true,
	async fetch() {
		const body = await getJson<Raw>(gdacsUrl());
		if (!Array.isArray(body?.features)) throw new Error('GDACS no devuelve una lista de eventos');
		return parseGdacs(body);
	}
};
