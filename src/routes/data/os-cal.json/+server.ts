// Arc OS, app Calendario: festivos, próximas publicaciones de datos y resultados empresariales, recortados a lo que
// pinta el calendario. Se genera al construir; la app lo pide al abrirse (no va en el HTML de ninguna vista).
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import type { FinnhubData, HolidaysData, ReleaseCalData } from '#lib/types.ts';
import type { CalFeed } from '#lib/os/apps/cal/cal.ts';

export const prerender = true;

export async function GET() {
	const [holidays, releases, finnhub] = await Promise.all([
		dataset<HolidaysData>('holidays'),
		dataset<ReleaseCalData>('releases-cal'),
		dataset<FinnhubData>('finnhub')
	]);
	const data: CalFeed = {
		holidays: (holidays?.data.items ?? []).map((h) => ({ date: h.date, name: h.name, scope: h.scope })),
		releases: (releases?.data.events ?? []).slice(0, 300).map((e) => ({ date: e.date, allDay: e.allDay, title: e.title, source: e.source })),
		earnings: (finnhub?.data.earnings ?? []).slice(0, 1500).map((e) => ({ date: e.date, symbol: e.symbol, hour: e.hour }))
	};
	return json({ name: 'os-cal', fetchedAt: new Date().toISOString(), data });
}
