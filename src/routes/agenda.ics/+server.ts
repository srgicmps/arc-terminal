// Agenda suscribible (/agenda.ics): bancos centrales, datos macro y resultados. Se genera al construir la web
// (prerender), así que se renueva con cada publicación. La lógica, en src/lib/ics.ts; el enlace, en CAL.
import { CB_MEETINGS } from '#lib/cb-calendar.ts';
import { dataset } from '#lib/data.ts';
import { calendar, earningsEvent, meetingEvent, releaseEvent } from '#lib/ics.ts';
import { minus } from '#lib/imp.ts';
import { madridDate } from '#lib/meetings.ts';
import type { FinnhubData, ReleaseCalData } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const [finnhub, releases] = await Promise.all([dataset<FinnhubData>('finnhub'), dataset<ReleaseCalData>('releases-cal')]);
	const now = new Date().toISOString();
	// Desde hace una semana (para no borrar de golpe lo de estos días) hasta lo último que se sepa.
	const from = minus(madridDate(Date.now()), 7);
	const events = [
		...CB_MEETINGS.filter((m) => m.date >= from).map(meetingEvent),
		...[...(releases?.data.past ?? []), ...(releases?.data.events ?? [])].filter((r) => r.date.slice(0, 10) >= from).map(releaseEvent),
		...(finnhub?.data.earnings ?? []).filter((e) => e.date >= from).map(earningsEvent)
	];
	const unique = [...new Map(events.map((e) => [e.uid, e])).values()];
	return new Response(calendar(unique, now), {
		headers: { 'content-type': 'text/calendar; charset=utf-8' }
	});
}
