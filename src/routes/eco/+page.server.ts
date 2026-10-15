import { dataset, type SourceStatus } from '#lib/data.ts';
import type { FaoData } from '#lib/fao.ts';
import type { UncertaintyData } from '#lib/uncertainty.ts';
import { missingNote } from '#lib/missing.ts';
import { headlines, pickSeries } from '#lib/trim.ts';
import type { EuPowerData, G20Data, ImfData, NewsData, PredictionsData, SeriesData, ReleaseCalData } from '#lib/types.ts';
import { nextMap } from '#lib/nextrelease.ts';
import { SEP_IDS } from '#lib/sep.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, gie, housing, imf, g20, news, predictions, status, speeches, cal, fao, bde, eupower, uncertainty, g4, indeed] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		// Gas almacenado: la tabla compara con hace un año, así que necesita todo el historial.
		dataset<SeriesData>('gie'),
		dataset<SeriesData>('housing'),
		dataset<ImfData>('imf'),
		dataset<G20Data>('oecd'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions'),
		dataset<SourceStatus[]>('status'),
		dataset<NewsData>('speeches'),
		dataset<ReleaseCalData>('releases-cal'),
		dataset<FaoData>('fao'),
		// Prima de riesgo diaria del Banco de España: solo se pinta el último dato y el de hace una semana.
		dataset<SeriesData>('bde'),
		dataset<EuPowerData>('energycharts'),
		dataset<UncertaintyData>('uncertainty'),
		// Paro y PIB de EE. UU., Reino Unido, Japón y China (OCDE vía DBnomics), para las tablas por país.
		dataset<SeriesData>('oecd-g4'),
		// Ofertas de empleo de Indeed (provisional): un punto por semana; con 60 llega para comparar con hace un año.
		dataset<SeriesData>('indeed')
	]);
	// Del BCE, todo menos los tipos de cambio (están en WS); de los titulares, los 25 que se pintan.
	const fx = (ecb?.data.series ?? [])
		.filter((s) => s.id.startsWith('eur') && !s.id.startsWith('euribor'))
		.map((s) => s.id);
	// El CISS va aparte, recortado, para el panel de estrés financiero.
	const rest = (ecb?.data.series ?? []).map((s) => s.id).filter((id) => !fx.includes(id) && id !== 'ciss-ea');
	// Si no hay datos de FRED, solo el motivo (sin clave, error de descarga…), no todo status.json.
	const fredMissing = fred ? null : missingNote(status?.data, 'fred');
	return {
		eurostat,
		ecb: pickSeries(ecb, rest),
		bls,
		usdebt,
		fred,
		fredMissing,
		// Señales de recesión (provisional): solo sus tres series y los puntos del minigráfico.
		recession: pickSeries(fred, ['sahm-us', 'recprob-us', 't10y3m-us'], 60),
		// Panel provisional «Estrés financiero»: CISS (~6 meses de días hábiles) y STLFSI4 (un año de semanas).
		stress: { ecb: pickSeries(ecb, ['ciss-ea'], 120), fred: pickSeries(fred, ['stlfsi-us'], 52) },
		// Panel provisional «Proyecciones de la Fed» (SEP): solo sus series.
		sep: pickSeries(fred, SEP_IDS),
		bis,
		gie,
		housing,
		imf,
		g20,
		g4,
		// De la prima diaria basta con las dos últimas semanas.
		bde: bde && { ...bde, data: { series: bde.data.series.map((x) => ({ ...x, points: x.points.slice(-10) })) } },
		news: headlines(news, 25),
		predictions,
		speeches: headlines(speeches, 12),
		fao,
		uncertainty,
		indeed: pickSeries(indeed, null, 60),
		eupower,
		// Próximo dato de cada serie, calculado aquí: al navegador solo le llega la fecha y el título.
		next: nextMap(
			[eurostat, bls, fred, usdebt, bis].flatMap((d) => d?.data.series.map((s) => s.id) ?? []),
			cal?.data.events ?? []
		)
	};
};
