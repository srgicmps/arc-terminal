import { dataset } from '#lib/data.ts';
import { countryName } from '#lib/risk-signals.ts';
import { headlines, trim } from '#lib/trim.ts';
import type { HnItem, KevData, NewsData, RadarData, RadarTarget, Release, TradeDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, releases, kev, sanctions, reg, radar] = await Promise.all([
		dataset<NewsData>('news-tech'),
		dataset<HnItem[]>('hn'),
		dataset<Release[]>('releases'),
		dataset<KevData>('cisa-kev'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<NewsData>('news-reg'),
		dataset<RadarData>('radar')
	]);
	// Chips y control de exportaciones (M33): solo las normas de la BIS, las de chips primero; 8 como mucho.
	const exports = trim(sanctions, (d) =>
		d
			.filter((x) => x.agency === 'BIS')
			.sort((a, b) => Number(b.topic === 'Chips') - Number(a.topic === 'Chips') || b.date.localeCompare(a.date))
			.slice(0, 8)
	);
	// Cloudflare Radar: los países ya en español; de los cortes, los 6 más recientes.
	const es = (t: RadarTarget): RadarTarget => ({ ...t, name: countryName(t.code, t.name) });
	const ddos = radar && {
		fetchedAt: radar.fetchedAt,
		l3: radar.data.l3.map(es),
		l7: radar.data.l7.map(es),
		outages: radar.data.outages.slice(0, 6).map((o) => ({ ...o, country: o.codes.map((c) => countryName(c, c)).join(', ') || 'Varios países' }))
	};
	return { news, hn, releases, kev, exports, reg: headlines(reg, 12), ddos };
};
