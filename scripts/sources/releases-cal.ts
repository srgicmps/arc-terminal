// Calendarios oficiales de publicación: cuándo sale el próximo dato. Tres archivos .ics públicos, sin clave:
// - Eurostat, calendario de publicaciones (en inglés; hora de Luxemburgo).
// - BLS, Oficina de Estadísticas Laborales de EE. UU. (hora del Este).
// - INE, calendario de disponibilidad de estadísticas (hora de Madrid).
// Se guardan los eventos de los próximos 45 días; si un calendario falla, se reutilizan sus eventos de la
// copia anterior y los demás siguen.
import { topicOf } from '../../src/lib/nextrelease.ts';
import type { ReleaseCalData, ReleaseEvent } from '../../src/lib/types.ts';
import { parseIcs } from '../ics.ts';
import { getText, type Source } from '../lib.ts';

const CALENDARS: { source: ReleaseEvent['source']; url: string; tz: string }[] = [
	{
		source: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/cache/RELEASE_CALENDAR/calendar_EN.ics',
		tz: 'Europe/Luxembourg'
	},
	{ source: 'BLS', url: 'https://www.bls.gov/schedule/news_release/bls.ics', tz: 'America/New_York' },
	{ source: 'INE', url: 'https://www.ine.es/dynt3/Calendario/calendario.ics', tz: 'Europe/Madrid' }
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

export const releasesCal: Source<ReleaseCalData> = {
	name: 'releases-cal',
	label: 'Próximos datos · calendarios de Eurostat, BLS e INE',
	maxAgeMinutes: 6 * 60,
	async fetch(previous) {
		// Desde el principio del día de hoy, para que el dato de esta mañana siga saliendo hoy.
		const from = new Date();
		from.setUTCHours(0, 0, 0, 0);
		const results = await Promise.allSettled(
			CALENDARS.map(async (c) =>
				upcoming(c.source, await getText(c.url, { headers: { Accept: 'text/calendar, */*' } }), c.tz, from)
			)
		);
		const fromIso = from.toISOString();
		const events = results.flatMap((r, i) =>
			r.status === 'fulfilled'
				? r.value
				: (previous?.events ?? []).filter((e) => e.source === CALENDARS[i].source && e.date >= fromIso)
		);
		if (results.every((r) => r.status === 'rejected')) throw new Error('ningún calendario responde');
		return { events: events.sort((a, b) => a.date.localeCompare(b.date)) };
	}
};
