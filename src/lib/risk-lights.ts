// Semáforo de riesgo (TOP): una fila con el último dato de cada indicador y su estado, según umbrales fijos.
// Complementa al termómetro (src/lib/risk.ts), que compara con el último año; aquí cuenta el nivel absoluto.
// Sin fuentes nuevas: series que ya descargan ecb.ts, fred.ts, vix.ts y uncertainty.ts.
//
// Umbrales (calma · vigilancia · tensión):
// - CISS del BCE (0 a 1): < 0,20 · 0,20–0,40 · ≥ 0,40. El 0,40 es el «alto» de src/lib/stress.ts (crisis de verdad).
// - STLFSI4 de la Fed de San Luis (0 = normal, 1 punto = 1 desviación típica): ≤ 0 · 0–1 · > 1.
// - VIX: < 20 · 20–30 · ≥ 30. Su media histórica ronda 19-20; por encima de 30 es pánico.
// - Curva del VIX (VIX entre VIX3M): < 0,90 · 0,90–1 · ≥ 1. En calma, el plazo corto es más barato
//   (contango); si el VIX a 1 mes supera al de 3 meses (backwardation), el miedo es inmediato.
// - Alto rendimiento de EE. UU. (diferencial ICE BofA, %): < 4 · 4–6 · ≥ 6. Media de largo plazo, en torno al 5 %.
// - Curva 10 años − 3 meses de EE. UU. (%): ≥ 0 · −0,5–0 · < −0,5. Invertida, el aviso clásico de recesión.
// - Probabilidad de recesión (modelo de Chauvet y Piger, %): < 20 · 20–50 · ≥ 50. El 50 es el de src/lib/recession.ts.
// - Incertidumbre económica mundial (EPU, 100 = media de 1997–2015): < 200 · 200–300 · ≥ 300. Desde 2016 casi
//   nunca baja de 150; pasó de 300 con la covid y con los aranceles de 2025.
// El riesgo geopolítico (GPR) no está: solo se publica en .xls antiguo (ver scripts/sources/uncertainty.ts).
import type { Point, Series, VixData } from './types.ts';

export type Level = 'calm' | 'watch' | 'stress';

export interface LightRule {
	id: string;
	/** Nombre corto, para la fila. */
	label: string;
	/** Qué es, para el título al pasar el ratón y la nota. */
	name: string;
	/** Límites entre calma y vigilancia y entre vigilancia y tensión. */
	watch: number;
	stress: number;
	/** true si un valor más alto es más riesgo; false si es al revés (curva de tipos). */
	higher: boolean;
	/** true: hay que pasar el umbral (>); si no, basta con llegar (≥). */
	strict?: boolean;
	/** Cómo se escribe el valor. */
	format: (v: number) => string;
	/** Los umbrales escritos: «< 20 · 20–30 · ≥ 30». */
	rule: string;
}

export interface Light {
	id: string;
	label: string;
	name: string;
	value: string;
	/** Fecha del dato (AAAA-MM-DD). */
	date: string;
	level: Level;
	rule: string;
}

const nf = (v: number, d: number) =>
	v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');

export const LIGHT_RULES: LightRule[] = [
	{ id: 'ciss', label: 'CISS', name: 'Estrés sistémico de la zona euro (BCE)', watch: 0.2, stress: 0.4, higher: true, format: (v) => nf(v, 2), rule: '< 0,20 · 0,20–0,40 · ≥ 0,40' },
	{ id: 'stlfsi', label: 'STLFSI', name: 'Estrés financiero de EE. UU. (Fed de San Luis)', watch: 0, stress: 1, higher: true, strict: true, format: (v) => nf(v, 2), rule: '≤ 0 · 0–1 · > 1' },
	{ id: 'vix', label: 'VIX', name: 'Volatilidad del S&P 500 a 30 días (Cboe)', watch: 20, stress: 30, higher: true, format: (v) => nf(v, 1), rule: '< 20 · 20–30 · ≥ 30' },
	{ id: 'vix-curve', label: 'VIX/3M', name: 'Curva del VIX: VIX entre VIX a 3 meses (Cboe)', watch: 0.9, stress: 1, higher: true, format: (v) => nf(v, 2), rule: '< 0,90 · 0,90–1 · ≥ 1' },
	{ id: 'hy', label: 'HY', name: 'Diferencial de los bonos de alto rendimiento de EE. UU. (ICE BofA, FRED)', watch: 4, stress: 6, higher: true, format: (v) => `${nf(v, 2)} %`, rule: '< 4 % · 4–6 % · ≥ 6 %' },
	{ id: 'curve', label: '10a−3m', name: 'Curva de EE. UU.: 10 años menos 3 meses (FRED)', watch: 0, stress: -0.5, higher: false, strict: true, format: (v) => `${nf(v, 2)} %`, rule: '≥ 0 · −0,5–0 · < −0,5' },
	{ id: 'recession', label: 'Recesión', name: 'Probabilidad de recesión en EE. UU. (Chauvet y Piger, FRED)', watch: 20, stress: 50, higher: true, format: (v) => `${nf(v, 0)} %`, rule: '< 20 % · 20–50 % · ≥ 50 %' },
	{ id: 'epu', label: 'EPU', name: 'Incertidumbre económica mundial (Baker, Bloom y Davis)', watch: 200, stress: 300, higher: true, format: (v) => nf(v, 0), rule: '< 200 · 200–300 · ≥ 300' }
];

/** Estado de un valor: si pasa (o llega a) `stress`, tensión; si no, si pasa (o llega a) `watch`, vigilancia. */
export function level(rule: LightRule, v: number): Level {
	const past = (limit: number) =>
		rule.higher ? (rule.strict ? v > limit : v >= limit) : rule.strict ? v < limit : v <= limit;
	return past(rule.stress) ? 'stress' : past(rule.watch) ? 'watch' : 'calm';
}

/** VIX entre VIX3M del último día que tenga los dos. */
export function vixRatio(vix: VixData | null | undefined): Point | null {
	if (!vix) return null;
	const i1 = vix.tenors.indexOf('1M');
	const i3 = vix.tenors.indexOf('3M');
	for (const d of [...vix.days].reverse()) {
		const a = d.values[i1];
		const b = d.values[i3];
		if (a != null && b) return { t: d.date, v: a / b };
	}
	return null;
}

/** El VIX de Cboe (último cierre), o el de FRED si no está. */
function vixLast(vix: VixData | null | undefined, fred: Point | undefined): Point | undefined {
	const i = vix?.tenors.indexOf('1M') ?? -1;
	const day = vix?.days.findLast((d) => d.values[i] != null);
	return day ? { t: day.date, v: day.values[i]! } : fred;
}

interface Inputs {
	/** Series por id (ecb, fred y uncertainty juntos): «ciss-ea», «stlfsi-us», «vix», «hy-us», «t10y3m-us», «recprob-us», «epu-global». */
	get: (id: string) => Series | null | undefined;
	vix?: VixData | null;
}

/** Las luces que tengan dato, en el orden de LIGHT_RULES. */
export function riskLights({ get, vix }: Inputs): Light[] {
	const last = (id: string) => get(id)?.points.at(-1);
	const points: Record<string, Point | null | undefined> = {
		ciss: last('ciss-ea'),
		stlfsi: last('stlfsi-us'),
		vix: vixLast(vix, last('vix')),
		'vix-curve': vixRatio(vix),
		hy: last('hy-us'),
		curve: last('t10y3m-us'),
		recession: last('recprob-us'),
		epu: last('epu-global')
	};
	return LIGHT_RULES.flatMap((r) => {
		const p = points[r.id];
		if (!p || !Number.isFinite(p.v)) return [];
		return [{ id: r.id, label: r.label, name: r.name, value: r.format(p.v), date: p.t.slice(0, 10), level: level(r, p.v), rule: r.rule }];
	});
}
