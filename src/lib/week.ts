// SEMANA: resumen de los últimos 7 días y agenda de los 7 siguientes. Función pura: recibe los datos ya
// leídos (IMP, series diarias de mercados y el calendario de publicaciones) y no lee nada por su cuenta.
import { aggregate, type ImpTotal } from './imp.ts';
import { diffDays, last, pctDays } from './series.ts';
import type { ImpData, ReleaseCalData, ReleaseEvent, Series } from './types.ts';

const DAY = 86_400_000;

/** Un mercado del resumen: precios en % y tipos de interés en puntos básicos. */
export interface WeekMarketInput {
	label: string;
	series: Series | undefined;
	kind: 'pct' | 'pb';
	/** Decimales del último dato; por defecto, 2. */
	decimals?: number;
}

export interface WeekMarket {
	label: string;
	last: number;
	/** Fecha del último dato: «2026-10-14». */
	t: string;
	/** Variación en 7 días: % para precios, puntos básicos para tipos. Null si la serie no llega tan atrás. */
	change: number | null;
	kind: 'pct' | 'pb';
	decimals: number;
	/** Fuente de la serie, para la nota. */
	source: string;
}

export interface WeekSummary {
	/** Los 10 temas que más sumaron en IMP en los últimos 7 días. */
	top: ImpTotal[];
	markets: WeekMarket[];
	/** Datos macro publicados en los últimos 7 días, del más reciente al más antiguo. */
	macro: ReleaseEvent[];
	/** Publicaciones de los próximos 7 días, por fecha. */
	agenda: ReleaseEvent[];
}

export function weekSummary(input: {
	imp: ImpData | null | undefined;
	markets: WeekMarketInput[];
	releases: ReleaseCalData | null | undefined;
	now?: Date;
}): WeekSummary {
	const now = input.now ?? new Date();
	const nowIso = now.toISOString();
	const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
	const weekAhead = new Date(now.getTime() + 7 * DAY).toISOString();
	const events = [...(input.releases?.past ?? []), ...(input.releases?.events ?? [])];
	const seen = new Set<string>();
	const unique = events.filter((e) => {
		const k = `${e.date}|${e.source}|${e.title}`;
		return !seen.has(k) && !!seen.add(k);
	});

	return {
		top: input.imp ? aggregate(input.imp.days, input.imp.date, 7, 10) : [],
		markets: input.markets.flatMap((m) => {
			const p = last(m.series);
			if (!m.series || !p) return [];
			const d = m.kind === 'pct' ? pctDays(m.series, 7) : diffDays(m.series, 7);
			return [
				{
					label: m.label,
					last: p.v,
					t: p.t,
					change: d === null ? null : m.kind === 'pb' ? Math.round(d * 100) : d,
					kind: m.kind,
					decimals: m.decimals ?? 2,
					source: m.series.source
				}
			];
		}),
		macro: unique.filter((e) => e.date >= weekAgo && e.date < nowIso).sort((a, b) => b.date.localeCompare(a.date)),
		agenda: unique.filter((e) => e.date >= nowIso && e.date < weekAhead).sort((a, b) => a.date.localeCompare(b.date))
	};
}

/** Serie diaria a partir de puntos { date, valor } (bitcoin, curva del Tesoro), para el resumen. */
export function dailySeries(id: string, label: string, unit: string, source: string, rows: { date: string; v: number | null }[]): Series | undefined {
	const points = rows.filter((r): r is { date: string; v: number } => r.v !== null).map((r) => ({ t: r.date, v: r.v }));
	return points.length ? { id, label, unit, points, source } : undefined;
}
