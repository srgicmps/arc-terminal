// F19 «Por qué se mueve»: en la ficha de un valor, su variación del día junto a los titulares de las últimas
// 24 h que lo nombran. Usa lo que ya hay: el índice de menciones (scripts/news-index.ts) y las cotizaciones de
// Finnhub (finnhub.json y alert-quotes.json). No hace llamadas nuevas.
import type { Quote } from './types.ts';

export const WHY_HOURS = 24;

/** Los titulares de las últimas `hours` horas respecto a `now`, del más nuevo al más viejo. Sin hora, fuera. */
export function recent<T extends { time: string | null }>(items: T[], now: number, hours = WHY_HOURS): T[] {
	const from = now - hours * 3_600_000;
	return items
		.filter((i) => {
			const t = i.time ? Date.parse(i.time) : NaN;
			return Number.isFinite(t) && t >= from && t <= now + 3_600_000;
		})
		.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
}

/** La cotización más reciente de un símbolo entre varias listas (Finnhub usa «BRK.B»; la barra, «BRK.B» también). */
export function latestQuote(code: string, ...lists: (Quote[] | null | undefined)[]): Quote | null {
	const all = lists.flatMap((l) => l ?? []).filter((q) => q.symbol === code && q.changePct !== null);
	return all.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))[0] ?? null;
}

/** Frase corta para el modo Sencillo: «NVIDIA sube un 2,3 % hoy y sale en 4 titulares de las últimas 24 h». */
export function whySentence(name: string, pct: number | null, count: number): string {
	const move =
		pct === null
			? ''
			: Math.abs(pct) < 0.05
				? `${name} está plana`
				: `${name} ${pct > 0 ? 'sube' : 'baja'} un ${Math.abs(pct).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
	const news = count ? `sale en ${count} ${count === 1 ? 'titular' : 'titulares'} de las últimas 24 h` : 'no sale en titulares de las últimas 24 h';
	return move ? `${move} y ${news}.` : `${name} ${news}.`;
}
