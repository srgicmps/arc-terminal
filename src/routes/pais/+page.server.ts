import { advisoryCountry } from '#lib/advisories.ts';
import { COUNTRIES } from '#lib/countries.ts';
import { countryProfile, type CountryProfile } from '#lib/country.ts';
import { dataset } from '#lib/data.ts';
import type { MilexData, MilexRow } from '#lib/milex.ts';
import { countryRisks } from '#lib/risk-signals.ts';
import type { Mention } from '#lib/news.ts';
import type {
	AdvisoriesData,
	EuPowerData,
	GdacsEvent,
	ImfData,
	IodaOutage,
	OutbreakNews,
	SeriesData,
	TravelAdvisory,
	YieldCurveData
} from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// El país se elige en el navegador (?c=DE), así que aquí se calcula la ficha de todos: solo viajan las
// cifras que pinta cada una (último dato y anterior), no las series enteras. Los países sin ningún dato no
// van; los titulares llegan ya repartidos por país (scripts/news-index.ts → news-countries.json).
export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, fred, bis, uscurve, imf, news, advisories, eupower, sipri, gdacs, ioda, who] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<YieldCurveData>('uscurve'),
		dataset<ImfData>('imf'),
		dataset<Record<string, Mention[]>>('news-countries'),
		dataset<AdvisoriesData>('advisories'),
		dataset<EuPowerData>('energycharts'),
		dataset<MilexData>('sipri'),
		dataset<GdacsEvent[]>('gdacs'),
		dataset<IodaOutage[]>('ioda'),
		dataset<OutbreakNews[]>('who-don')
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
	// Gasto militar (SIPRI): solo la fila de cada país que conoce la terminal.
	const military: Record<string, MilexRow> = {};
	for (const r of sipri?.data.rows ?? []) if (r.code && COUNTRIES.some((c) => c.code === r.code)) military[r.code] = r;
	// Luz en Europa: todas las zonas (son pocas); la ficha enseña las del país frente a la media de todas.
	return {
		profiles,
		news: news?.data ?? {},
		travel,
		travelAt: advisories?.fetchedAt,
		// Riesgo: catástrofes (GDACS), caída de internet (IODA) y brotes (OMS) de cada país, solo los que tienen algo.
		risks: countryRisks({ gdacs: gdacs?.data, ioda: ioda?.data, who: who?.data }, Date.now()),
		riskAt: { gdacs: gdacs?.fetchedAt, ioda: ioda?.fetchedAt, who: who?.fetchedAt },
		eupower: eupower?.data.zones ?? [],
		eupowerAt: eupower?.fetchedAt,
		military,
		militaryYear: sipri?.data.year ?? null,
		militaryAt: sipri?.fetchedAt ?? null
	};
};
