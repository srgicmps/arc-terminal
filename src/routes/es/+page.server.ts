import { dataset } from '#lib/data.ts';
import { headlines, pickSeries, trim } from '#lib/trim.ts';
import type { FuelSpainData } from '#lib/fuel.ts';
import type { BoeData, NewsData, PowerData, Quake, SeriesData, ReleaseCalData } from '#lib/types.ts';
import { nextMap } from '#lib/nextrelease.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, gov, boe, power, eurostat, ecb, fuel, quakes, ine, cal] = await Promise.all([
		dataset<NewsData>('news-es'),
		dataset<NewsData>('news-gov'),
		dataset<BoeData>('boe'),
		dataset<PowerData>('power'),
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<FuelSpainData>('fuel-es'),
		dataset<Quake[]>('quakes-es'),
		dataset<SeriesData>('ine'),
		dataset<ReleaseCalData>('releases-cal')
	]);
	return {
		news,
		gov: headlines(gov, 60),
		// Del BOE solo se pintan las 12 primeras disposiciones generales.
		boe: trim(boe, (d) => ({
			...d,
			sections: d.sections.filter((s) => s.code === '1').map((s) => ({ ...s, items: s.items.slice(0, 12) }))
		})),
		power: trim(power, (d) => ({ pvpc: d.pvpc, spot: [] })),
		eurostat: pickSeries(eurostat, ['unemployment-es', 'youth-unemployment-es', 'inflation-es', 'gdp-es', 'debt-es']),
		ecb: pickSeries(ecb, ['bond10-es', 'bond10-de', 'mortgage-es']),
		// De las gasolineras de España, solo la media del día (el historial por provincias pesa mucho y es de FUEL).
		fuel: trim(fuel, (d) => ({ sourceDate: d.sourceDate, avg: d.avg, provinces: [] })),
		// Terremotos del IGN: solo los 15 más fuertes, que es lo que se pinta (el más fuerte va en «España en cifras»).
		quakes: trim(quakes, (d) => [...d].sort((a, b) => b.mag - a.mag).slice(0, 15)),
		ine,
		// Próximo dato de cada serie, calculado aquí: al navegador solo le llega la fecha y el título.
		next: nextMap(
			[eurostat, ine].flatMap((d) => d?.data.series.map((s) => s.id) ?? []),
			cal?.data.events ?? []
		)
	};
};
