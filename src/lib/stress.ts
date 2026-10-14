// Estrés financiero (ECO, panel provisional): el último dato de dos índices y si está en zona alta.
//
// - CISS del BCE (zona euro): de 0 (calma) a 1 (estrés máximo). «Alto» desde 0,40. Como referencia, tocó
//   ~0,8 tras la quiebra de Lehman (2008), ~0,6 en la crisis del euro (2011-2012), ~0,5 con la covid (2020) y
//   ~0,35 en 2022; en épocas tranquilas va por debajo de 0,1. Con 0,40 se marcan las crisis de verdad y no
//   los sustos normales del mercado.
// - STLFSI4 de la Fed de San Luis (EE. UU.): 0 es lo normal y cada punto, una desviación típica. «Alto» por
//   encima de 1: más de una desviación típica por encima de lo habitual.
//
// Para quitar el panel: este archivo, su test, FinancialStress.svelte, su línea en eco/+page.svelte y en
// eco/+page.server.ts, la entrada del manual (commands/eco.ts) y las series «ciss-ea» (ecb.ts) y «stlfsi-us» (fred.ts).
import type { Series } from './types.ts';

export interface StressRule {
	id: string;
	/** Nombre en la tabla. */
	name: string;
	/** Umbral a partir del cual el estrés es alto. */
	limit: number;
	/** true: hay que pasar el umbral (>); false: basta con llegar (≥). */
	strict: boolean;
	/** El umbral escrito, para la tabla y la nota. */
	rule: string;
	decimals: number;
}

export const STRESS_RULES: StressRule[] = [
	{ id: 'ciss-ea', name: 'CISS · zona euro', limit: 0.4, strict: false, rule: '≥ 0,40', decimals: 3 },
	{ id: 'stlfsi-us', name: 'Fed de San Luis · EE. UU.', limit: 1, strict: true, rule: '> 1', decimals: 2 }
];

export interface StressReading extends StressRule {
	series: Series;
	last: number;
	/** Fecha del último dato («2026-10-13»). */
	date: string;
	high: boolean;
}

/** Lectura de un índice con su regla; null si falta la serie o no tiene datos. */
export function stressReading(rule: StressRule, series: Series | null | undefined): StressReading | null {
	const p = series?.points.at(-1);
	if (!series || !p || !Number.isFinite(p.v)) return null;
	const high = rule.strict ? p.v > rule.limit : p.v >= rule.limit;
	return { ...rule, series, last: p.v, date: p.t, high };
}

/** Las lecturas de los índices que haya, en el orden de STRESS_RULES. `get` busca una serie por id. */
export function financialStress(get: (id: string) => Series | null | undefined): StressReading[] {
	return STRESS_RULES.flatMap((r) => stressReading(r, get(r.id)) ?? []);
}
