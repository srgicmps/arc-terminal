// Calendarios oficiales de publicación: cuándo sale el próximo dato.
// - INE, calendario de disponibilidad de estadísticas (.ics público, hora de Madrid).
// - Eurostat, aparcado: el .ics de su página antigua da 404 y no se ha encontrado el nuevo (ver CLAUDE.md).
// - BLS: su .ics prohíbe los robots (responde 403 a la Action), así que las fechas del IPC y del empleo de
//   EE. UU. salen de la API de FRED (release/dates), con la clave FRED_API_KEY que ya existe. Sin ella, se
//   salta solo esa parte. El BLS publica siempre a las 8:30 de Nueva York.
// - Con la misma clave, también de FRED: el PIB y el PCE (BEA, 8:30), el paro semanal (Departamento de
//   Trabajo, los jueves a las 8:30) y el balance de la Fed (H.4.1, los jueves a las 16:30), todo de Nueva York.
// Se guardan los eventos de los próximos 45 días; si un calendario falla, se reutilizan sus eventos de la
// copia anterior y los demás siguen.
import { topicOf } from '../../src/lib/nextrelease.ts';
import type { ReleaseCalData, ReleaseEvent } from '../../src/lib/types.ts';
import { parseIcs, zonedToUtc } from '../ics.ts';
import { getJson, getText, type Source } from '../lib.ts';

const CALENDARS: { source: ReleaseEvent['source']; url: string; tz: string }[] = [
	{ source: 'INE', url: 'https://www.ine.es/dynt3/Calendario/calendario.ics', tz: 'Europe/Madrid' }
];

/** Publicaciones de EE. UU. en FRED: id de la «release», título, organismo y hora de Nueva York. */
export const FRED_RELEASES: { id: number; title: string; source: ReleaseEvent['source']; at: [number, number] }[] = [
	{ id: 10, title: 'Consumer Price Index', source: 'BLS', at: [8, 30] },
	{ id: 50, title: 'Employment Situation', source: 'BLS', at: [8, 30] },
	{ id: 53, title: 'Gross Domestic Product', source: 'BEA', at: [8, 30] },
	{ id: 54, title: 'Personal Income and Outlays', source: 'BEA', at: [8, 30] },
	{ id: 180, title: 'Unemployment Insurance Weekly Claims Report', source: 'DOL', at: [8, 30] },
	{ id: 20, title: 'H.4.1 Factors Affecting Reserve Balances', source: 'Fed', at: [16, 30] }
];

const DAYS = 45;
/** Días hacia atrás que se guardan en `past`. */
const PAST_DAYS = 8;

/**
 * Las publicaciones que ya pasaron (antes de `from`) en los últimos PAST_DAYS días, sacadas de la copia
 * anterior: las que eran próximas y las que ya estaban en `past`. Sin repetir y por fecha.
 */
export function pastEvents(previous: ReleaseCalData | undefined, from: Date): ReleaseEvent[] {
	const fromIso = from.toISOString();
	const since = new Date(from.getTime() - PAST_DAYS * 86_400_000).toISOString();
	const seen = new Set<string>();
	return [...(previous?.past ?? []), ...(previous?.events ?? [])]
		.filter((e) => e.date < fromIso && e.date >= since)
		.filter((e) => {
			const k = `${e.date}|${e.source}|${e.title}`;
			return !seen.has(k) && !!seen.add(k);
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}
/** Como mucho, eventos por calendario. */
const MAX = 60;

/** Eventos de un calendario entre `from` y `from + DAYS`, con su tema. */
export function upcoming(source: ReleaseEvent['source'], ics: string, tz: string, from: Date): ReleaseEvent[] {
	const to = new Date(from.getTime() + DAYS * 86_400_000).toISOString();
	const start = from.toISOString();
	return (
		parseIcs(ics, tz)
			.filter((e) => e.start >= start && e.start <= to)
			.sort((a, b) => a.start.localeCompare(b.start))
			.map((e) => ({
				date: e.start,
				allDay: e.allDay,
				title: e.summary.slice(0, 160),
				source,
				topic: topicOf(source, e.summary),
				...(e.url ? { url: e.url } : {})
			}))
			// Solo los datos que enseña la terminal: así el JSON es pequeño y el navegador lo puede pedir entero.
			.filter((e) => e.topic !== null)
			.slice(0, MAX)
	);
}

/** Próximas fechas de una publicación de EE. UU. según FRED (solo el día; la hora es la del organismo). */
export async function fromFred(r: (typeof FRED_RELEASES)[number], key: string, from: Date): Promise<ReleaseEvent[]> {
	const to = new Date(from.getTime() + DAYS * 86_400_000).toISOString().slice(0, 10);
	const params = new URLSearchParams({
		release_id: String(r.id),
		api_key: key,
		file_type: 'json',
		realtime_start: from.toISOString().slice(0, 10),
		include_release_dates_with_no_data: 'true',
		sort_order: 'asc',
		limit: '10'
	});
	const body = await getJson<{ release_dates?: { date?: string }[] }>(`https://api.stlouisfed.org/fred/release/dates?${params}`);
	return (body.release_dates ?? [])
		.map((d) => String(d.date ?? ''))
		.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= to)
		.map((d): ReleaseEvent => {
			const [y, m, day] = d.split('-').map(Number);
			return {
				date: zonedToUtc(y, m, day, r.at[0], r.at[1], 'America/New_York').toISOString(),
				allDay: false,
				title: r.title,
				source: r.source,
				topic: topicOf(r.source, r.title)
			};
		});
}

export const releasesCal: Source<ReleaseCalData> = {
	name: 'releases-cal',
	label: 'Próximos datos · calendario del INE y fechas del BLS, BEA, Departamento de Trabajo y Fed (vía FRED)',
	maxAgeMinutes: 6 * 60,
	async fetch(previous) {
		// Desde el principio del día de hoy, para que el dato de esta mañana siga saliendo hoy.
		const from = new Date();
		from.setUTCHours(0, 0, 0, 0);
		const key = process.env.FRED_API_KEY;
		// Cada calendario y cada publicación de FRED por separado: si una falla, se reutiliza solo lo suyo.
		const jobs: { name: string; mine: (e: ReleaseEvent) => boolean; run: () => Promise<ReleaseEvent[]> }[] = [
			...CALENDARS.map((c) => ({
				name: c.source,
				mine: (e: ReleaseEvent) => e.source === c.source,
				run: async () =>
					upcoming(c.source, await getText(c.url, { headers: { Accept: 'text/calendar, */*' } }), c.tz, from)
			})),
			...(key
				? FRED_RELEASES.map((r) => ({
						name: `${r.source} (${r.title})`,
						mine: (e: ReleaseEvent) => e.source === r.source && e.title === r.title,
						run: () => fromFred(r, key, from)
					}))
				: [])
		];
		const results = await Promise.allSettled(jobs.map((j) => j.run()));
		const fromIso = from.toISOString();
		// Si un calendario falla, sus eventos de la copia anterior (los que aún no han pasado).
		const events = results.flatMap((r, i) => {
			if (r.status === 'fulfilled') return r.value;
			console.warn(`releases-cal: ${jobs[i].name}: ${r.reason}`);
			return (previous?.events ?? []).filter((e) => jobs[i].mine(e) && e.date >= fromIso);
		});
		if (results.every((r) => r.status === 'rejected')) throw new Error('ningún calendario responde');
		return { events: events.sort((a, b) => a.date.localeCompare(b.date)), past: pastEvents(previous, from) };
	}
};
