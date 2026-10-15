// Inseguridad alimentaria aguda (FEWS NET): textos para GEO y PAIS. Lógica pura, con tests.
import { nf } from './format.ts';

/** Nombre del país en español a partir del código ISO; si no, el que da FEWS NET. */
export function foodCountry(code: string, fallback: string): string {
	try {
		return new Intl.DisplayNames('es', { type: 'region' }).of(code) ?? fallback;
	} catch {
		return fallback;
	}
}

/** Horquilla de personas: «8–9 M», «2,5–5 M», «500–1000 mil», o una sola cifra si FEWS NET da una. */
export function peopleRange(low: number, high: number): string {
	const millions = high >= 1e6;
	const short = (n: number) => {
		const v = millions ? Math.round(n / 1e5) / 10 : Math.round(n / 1e3);
		return nf(v, v % 1 ? 1 : 0);
	};
	const [lo, hi] = [short(low), short(high)];
	return `${lo === hi ? hi : `${lo}–${hi}`} ${millions ? 'M' : 'mil'}`;
}

/** «Higher» → «más que hace un año»… o null. */
export const vsYearText = (v: string | null) =>
	v === 'Higher' ? 'más que hace un año' : v === 'Lower' ? 'menos que hace un año' : v === 'Similar' ? 'como hace un año' : null;
