// Cifras del día para las experiencias (Periódico, Zen, Cabina…): el último valor de unas pocas series clave, su
// cambio frente al anterior y una explicación sencilla. Lógica pura: recibe un buscador de series (seriesMap).
import { nf, signed } from '../format.ts';
import type { Series } from '../types.ts';

export interface FigureDef {
	id: string;
	/** Id de la serie (ecb, eurostat, bls, fred…). */
	series: string;
	label: string;
	unit: string;
	decimals: number;
	/** Qué es, para alguien que no sabe de economía (Zen, «breves»). */
	explain: string;
	/** Sección del Periódico donde sale. */
	section: 'eco' | 'mercados' | 'es';
	/** Vista de Arc donde se ve en detalle. */
	view: string;
}

export const FIGURES: FigureDef[] = [
	{ id: 'euribor', series: 'euribor-12m', label: 'Euríbor a 12 meses', unit: '%', decimals: 3, section: 'es', view: '/eco', explain: 'La referencia de casi todas las hipotecas variables en España. Si sube, la cuota de la hipoteca sube en la próxima revisión.' },
	{ id: 'bce', series: 'ecb-dfr', label: 'Tipo del BCE', unit: '%', decimals: 2, section: 'eco', view: '/eco', explain: 'Lo que paga el Banco Central Europeo a los bancos por guardarles el dinero. Marca lo caro o barato que es pedir prestado en el euro.' },
	{ id: 'ipc-es', series: 'inflation-es', label: 'Inflación en España', unit: '%', decimals: 1, section: 'es', view: '/es', explain: 'Cuánto han subido los precios en un año. Alrededor del 2 % se considera sano; por encima, la compra y las facturas se encarecen.' },
	{ id: 'ipc-ea', series: 'inflation-ea', label: 'Inflación en la zona euro', unit: '%', decimals: 1, section: 'eco', view: '/eco', explain: 'La subida de precios en los países del euro. El BCE sube o baja tipos para mantenerla cerca del 2 %.' },
	{ id: 'paro-es', series: 'unemployment-es', label: 'Paro en España', unit: '%', decimals: 1, section: 'es', view: '/es', explain: 'De cada 100 personas que quieren trabajar, cuántas no encuentran trabajo.' },
	{ id: 'prima', series: 'premium-es', label: 'Prima de riesgo', unit: 'pb', decimals: 0, section: 'mercados', view: '/eco', explain: 'Lo que paga España de más que Alemania por pedir prestado a 10 años. Cuanto más baja, más confianza hay en España.' },
	{ id: 'bono-es', series: 'bond10-es', label: 'Bono español a 10 años', unit: '%', decimals: 2, section: 'mercados', view: '/wb', explain: 'Lo que cobra al año quien presta dinero al Estado español durante 10 años.' },
	{ id: 'eurusd', series: 'eurusd', label: 'Euro / dólar', unit: '$', decimals: 4, section: 'mercados', view: '/ws', explain: 'Cuántos dólares dan por un euro. Si sube, viajar a EE. UU. y comprar en dólares sale más barato.' },
	{ id: 'wti', series: 'wti', label: 'Petróleo (WTI)', unit: '$', decimals: 2, section: 'mercados', view: '/ws', explain: 'Precio del barril de petróleo en EE. UU. Acaba notándose en la gasolinera y en el transporte.' },
	{ id: 'vix', series: 'vix', label: 'VIX, el «índice del miedo»', unit: 'pts', decimals: 1, section: 'mercados', view: '/ws', explain: 'Mide cuánto nervio hay en la bolsa de EE. UU. Por debajo de 20, calma; por encima de 30, miedo.' },
	{ id: 'ipc-us', series: 'cpi-us', label: 'Inflación en EE. UU.', unit: '%', decimals: 1, section: 'eco', view: '/eco', explain: 'La subida de precios en EE. UU. en un año. De ella depende lo que haga la Reserva Federal con los tipos.' },
	{ id: 'paro-us', series: 'unemployment-us', label: 'Paro en EE. UU.', unit: '%', decimals: 1, section: 'eco', view: '/eco', explain: 'El porcentaje de estadounidenses que buscan trabajo y no lo encuentran.' }
];

/** Ids de series que necesitan las cifras (para recortar en el load). */
export const FIGURE_SERIES = [...new Set([...FIGURES.map((f) => f.series), 'bond10-de'])];

export interface Figure extends FigureDef {
	value: number;
	/** Cambio frente al dato anterior, en la unidad de la serie (null si no hay anterior). */
	change: number | null;
	/** Periodo del último dato («2026-09», «2026-10-14»). */
	t: string;
	source: string;
	text: string;
	changeText: string | null;
}

/** La prima de riesgo no es una serie publicada: bono español menos alemán, en puntos básicos. */
function premium(get: (id: string) => Series | undefined): Series | undefined {
	const es = get('bond10-es');
	const de = get('bond10-de');
	if (!es || !de) return undefined;
	const byT = new Map(de.points.map((p) => [p.t, p.v]));
	const points = es.points.flatMap((p) => (byT.has(p.t) ? [{ t: p.t, v: (p.v - byT.get(p.t)!) * 100 }] : []));
	return { id: 'premium-es', label: 'Prima de riesgo', unit: 'pb', points, source: es.source };
}

const unitText = (v: string, unit: string) => (unit === '%' ? `${v} %` : unit === 'pb' ? `${v} pb` : unit === '$' ? `${v} $` : `${v}`);

export function figures(get: (id: string) => Series | undefined, defs = FIGURES): Figure[] {
	return defs.flatMap((d) => {
		const s = d.series === 'premium-es' ? premium(get) : get(d.series);
		const last = s?.points.at(-1);
		if (!s || !last || !Number.isFinite(last.v)) return [];
		const prev = s.points.at(-2);
		const change = prev && Number.isFinite(prev.v) ? last.v - prev.v : null;
		return [
			{
				...d,
				value: last.v,
				change,
				t: last.t,
				source: s.source,
				text: unitText(nf(last.v, d.decimals), d.unit),
				changeText: change === null ? null : signed(change, d.decimals)
			}
		];
	});
}
