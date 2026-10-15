// Tarjetas de la app Sencilla: cada dato como una cifra grande, una flecha, una frase en español llano
// (plain.ts) y un minigráfico. Lógica pura: la usan los +page.server.ts de src/routes/app al construir, así que
// al navegador solo llegan las tarjetas, no los JSON enteros.
import { period, signed } from '../format.ts';
import { euriborPhrase, fxPhrase, inflationPhrase, premiumPhrase, unemploymentPhrase, yearAgo } from '../plain.ts';
import type { Point, Series } from '../types.ts';

export interface Fact {
	id: string;
	title: string;
	/** La cifra, ya escrita: «2,4 %». */
	value: string;
	/** Cuánto ha cambiado (para la flecha y el color); null si no se sabe. */
	delta: number | null;
	/** El cambio contado: «+0,2 puntos desde agosto». */
	change: string;
	/** La frase en español llano (plain.ts), si la hay. */
	phrase: string | null;
	/** Para el minigráfico: como mucho 36 valores, del más antiguo al último. */
	spark: number[];
	/** Clave de explain.ts (glosario) para el «¿qué es?» y el «¿por qué importa?». */
	explain: string;
	/** De cuándo es el dato: «sep 26». */
	when: string;
	source: string;
}

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const nf = (v: number, d: number) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

/** «2026-08» → «agosto»; si no es un mes, el periodo corto de format.ts. */
export function monthName(t: string): string {
	const m = t.match(/^\d{4}-(\d{2})$/);
	return m ? MONTHS_LONG[Number(m[1]) - 1] : period(t);
}

const spark = (points: readonly Point[], n = 36) => points.slice(-n).map((p) => p.v);

/** La variación contada en puntos: «+0,2 puntos desde agosto» o «igual que en agosto». */
function pointsChange(d: number, decimals: number, since: string, unit = 'puntos'): string {
	if (Math.round(Math.abs(d) * 10 ** decimals) === 0) return since.startsWith('hace') ? 'igual que hace un año' : `igual que en ${since}`;
	return `${signed(d, decimals)} ${unit} ${since.startsWith('hace') ? 'en un año' : `desde ${since}`}`;
}

interface Spec {
	id: string;
	title: string;
	explain: string;
	decimals: number;
	suffix: string;
	/** Contra qué se compara: el dato anterior o el de hace un año. */
	against: 'prev' | 'year';
	phrase: (s: Series) => string | null;
	unit?: string;
}

function build(s: Series | undefined, spec: Spec): Fact | null {
	const last = s?.points.at(-1);
	if (!s || !last) return null;
	const before = spec.against === 'year' ? yearAgo(s.points) : s.points.at(-2);
	const delta = before ? last.v - before.v : null;
	const since = spec.against === 'year' ? 'hace un año' : before ? monthName(before.t) : '';
	return {
		id: spec.id,
		title: spec.title,
		value: `${nf(last.v, spec.decimals)}${spec.suffix}`,
		delta,
		change: delta === null ? '' : pointsChange(delta, spec.decimals, since, spec.unit),
		phrase: spec.phrase(s),
		spark: spark(s.points),
		explain: spec.explain,
		when: period(last.t),
		source: s.source
	};
}

export const inflationFact = (s: Series | undefined, place = 'España') =>
	build(s, { id: 'inflacion', title: `Inflación en ${place}`, explain: 'cpi', decimals: 1, suffix: ' %', against: 'prev', phrase: (x) => inflationPhrase(place, x.points) });

export const unemploymentFact = (s: Series | undefined, place = 'España') =>
	build(s, { id: 'paro', title: `Paro en ${place}`, explain: 'unemployment', decimals: 1, suffix: ' %', against: 'prev', phrase: (x) => unemploymentPhrase(place, x.points) });

export const euriborFact = (s: Series | undefined) =>
	build(s, { id: 'euribor', title: 'Euríbor (hipotecas)', explain: 'euribor', decimals: 2, suffix: ' %', against: 'year', phrase: (x) => euriborPhrase(x.points) });

export const mortgageFact = (s: Series | undefined) =>
	build(s, {
		id: 'hipoteca',
		title: 'Interés de las hipotecas nuevas',
		explain: 'mortgage',
		decimals: 2,
		suffix: ' %',
		against: 'year',
		phrase: (x) => {
			const v = x.points.at(-1)?.v;
			return v == null ? null : `Quien firma hoy una hipoteca en España paga de media un ${nf(v, 2)} % de interés al año.`;
		}
	});

/** La prima de riesgo viene en puntos básicos (spread() de series.ts). */
export const premiumFact = (s: Series | undefined) =>
	build(s, { id: 'prima', title: 'Prima de riesgo de España', explain: 'premium', decimals: 0, suffix: ' puntos', against: 'year', unit: 'puntos', phrase: (x) => premiumPhrase('España', x.points.at(-1)?.v) });

export const eurusdFact = (s: Series | undefined) =>
	build(s, { id: 'euro-dolar', title: 'Euro frente al dólar', explain: 'euro-dolar', decimals: 2, suffix: ' $', against: 'year', unit: '$', phrase: (x) => fxPhrase(x.points) });

/** Las tarjetas que hay (sin las que faltan). */
export const present = (list: (Fact | null)[]): Fact[] => list.filter((f): f is Fact => !!f);
