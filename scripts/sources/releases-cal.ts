// Calendarios oficiales de publicación: cuándo sale el próximo dato.
// - INE, calendario de disponibilidad de estadísticas (.ics público, hora de Madrid).
// - Eurostat, calendario de publicaciones (.ics; hora de Luxemburgo).
// - BLS: su .ics prohíbe los robots (responde 403 a la Action), así que las fechas del IPC y del empleo de
//   EE. UU. salen de la API de FRED (release/dates), con la clave FRED_API_KEY que ya existe. Sin ella, se
//   salta solo esa parte. El BLS publica siempre a las 8:30 de Nueva York.
// Se guardan los eventos de los próximos 45 días; si un calendario falla, se reutilizan sus eventos de la
// copia anterior y los demás siguen.
import { topicOf } from '../../src/lib/nextrelease.ts';
import type { ReleaseCalData, ReleaseEvent } from '../../src/lib/types.ts';
import { parseIcs, zonedToUtc } from '../ics.ts';
import { getJson, getText, type Source } from '../lib.ts';

const CALENDARS: { source: ReleaseEvent['source']; url: string; tz: string }[] = [
	{
		source: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/cache/RELEASE_CALENDAR/calendar_EN.ics',
		tz: 'Europe/Luxembourg'
	},
	{ source: 'INE', url: 'https://www.ine.es/dynt3/Calendario/calendario.ics', tz: 'Europe/Madrid' }
];

/** Publicaciones del BLS en FRED: id de la «release» y título. */
const FRED_RELEASES = [
	{ id: 10, title: 'Consumer Price Index' },
	{ id: 50, title: 'Employment Situation' }
];

const DAYS = 45;
/** Como mucho, eventos por calendario (el del INE trae muchos al día). */
const MAX = 150;

/** Eventos de un calendario entre `from` y `from + DAYS`, con su tema. */
export function upcoming(source: ReleaseEvent['source'], ics: string, tz: string, from: Date): ReleaseEvent[] {
	const to = new Date(from.getTime() + DAYS * 86_400_000).toISOString();
	const start = from.toISOString();
	return parseIcs(ics, tz)
		.filter((e) => e.start >= start && e.start <= to)
		.sort((a, b) => a.start.localeCompare(b.start))
		.slice(0, MAX)
		.map((e) => ({
			date: e.start,
			allDay: e.allDay,
			title: e.summary.slice(0, 160),
			source,
			topic: topicOf(source, e.summary),
			...(e.url ? { url: e.url } : {})
		}));
}

/** Próximas fechas del IPC y del empleo de EE. UU. según FRED (solo el día; la hora es la del BLS). */
export async function blsFromFred(key: string, from: Date): Promise<ReleaseEvent[]> {
	const to = new Date(from.getTime() + DAYS * 86_400_000).toISOString().slice(0, 10);
	const lists = await Promise.all(
		FRED_RELEASES.map(async (r) => {
			const params = new URLSearchParams({
				release_id: String(r.id),
				api_key: key,
				file_type: 'json',
				realtime_start: from.toISOString().slice(0, 10),
				include_release_dates_with_no_data: 'true',
				sort_order: 'asc',
				limit: '10'
			});
			const body = await getJson<{ release_dates?: { date?: string }[] }>(
				`https://api.stlouisfed.org/fred/release/dates?${params}`
			);
			return (body.release_dates ?? [])
				.map((d) => String(d.date ?? ''))
				.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= to)
				.map((d): ReleaseEvent => {
					const [y, m, day] = d.split('-').map(Number);
					return {
						date: zonedToUtc(y, m, day, 8, 30, 'America/New_York').toISOString(),
						allDay: false,
						title: r.title,
						source: 'BLS',
						topic: topicOf('BLS', r.title)
					};
				});
		})
	);
	return lists.flat();
}

export const releasesCal: Source<ReleaseCalData> = {
	name: 'releases-cal',
	label: 'Próximos datos · calendarios de Eurostat, INE y BLS (vía FRED)',
	maxAgeMinutes: 6 * 60,
	async fetch(previous) {
		// Desde el principio del día de hoy, para que el dato de esta mañana siga saliendo hoy.
		const from = new Date();
		from.setUTCHours(0, 0, 0, 0);
		const key = process.env.FRED_API_KEY;
		const jobs: { source: ReleaseEvent['source']; run: () => Promise<ReleaseEvent[]> }[] = [
			...CALENDARS.map((c) => ({
				source: c.source,
				run: async () =>
					upcoming(c.source, await getText(c.url, { headers: { Accept: 'text/calendar, */*' } }), c.tz, from)
			})),
			...(key ? [{ source: 'BLS' as const, run: () => blsFromFred(key, from) }] : [])
		];
		const results = await Promise.allSettled(jobs.map((j) => j.run()));
		const fromIso = from.toISOString();
		// Si un calendario falla, sus eventos de la copia anterior (los que aún no han pasado).
		const events = results.flatMap((r, i) => {
			if (r.status === 'fulfilled') return r.value;
			console.warn(`releases-cal: ${jobs[i].source}: ${r.reason}`);
			return (previous?.events ?? []).filter((e) => e.source === jobs[i].source && e.date >= fromIso);
		});
		if (results.every((r) => r.status === 'rejected')) throw new Error('ningún calendario responde');
		return { events: events.sort((a, b) => a.date.localeCompare(b.date)) };
	}
};
