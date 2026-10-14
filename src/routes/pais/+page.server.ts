import { advisoryCountry } from '#lib/advisories.ts';
import { COUNTRIES } from '#lib/countries.ts';
import { countryProfile, type CountryProfile } from '#lib/country.ts';
import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { AdvisoriesData, ImfData, SeriesData, TravelAdvisory, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// El país se elige en el navegador (?c=DE), así que aquí se calcula la ficha de todos: solo viajan las
// cifras que pinta cada una (último dato y anterior), no las series enteras. Los países sin ningún dato no
// van; los titulares llegan ya repartidos por país (scripts/news-index.ts → news-countries.json).
export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, fred, bis, uscurve, imf, news, advisories] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<YieldCurveData>('uscurve'),
		dataset<ImfData>('imf'),
		dataset<Record<string, Mention[]>>('news-countries'),
		dataset<AdvisoriesData>('advisories')
	]);
	const sets = {
		series: [eurostat, ecb, bls, fred, bis].flatMap((d) => d?.data.series ?? []),
		curve: uscurve?.data ?? null,
		imf: imf?.data ?? null
	};
	const profiles: Record<string, CountryProfile> = {};
	for (const c of COUNTRIES) {
		const p = countryProfile(c, sets);
		if (p.kpis.length || p.policy || p.bond || p.premium || p.fx.length || p.imf) profiles[c.code] = p;
	}
	// Aviso de viaje de EE. UU. de cada país que conoce la terminal (sin el texto largo).
	const travel: Record<string, Omit<TravelAdvisory, 'name' | 'title'>> = {};
	for (const a of advisories?.data.items ?? []) {
		const c = advisoryCountry(a);
		if (c) travel[c.code] = { level: a.level, url: a.url, updated: a.updated, prevLevel: a.prevLevel, changedAt: a.changedAt };
	}
	return { profiles, news: news?.data ?? {}, travel, travelAt: advisories?.fetchedAt };
};
