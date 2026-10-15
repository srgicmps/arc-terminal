// GEO, «Señales de riesgo»: lo más grave de hoy con datos que ya se descargan (GDACS, IODA, OMS y avisos de
// viaje de EE. UU.). Lógica pura, con tests: el +page.server.ts la llama y al navegador llega solo esto.
import { levelCounts } from './advisories.ts';
import { COUNTRIES, findCountries } from './countries.ts';
import type { AdvisoriesData, GdacsEvent, IodaOutage, OutbreakNews, RadarOutage } from './types.ts';

const DAY = 86_400_000;
/** Brotes de la OMS que cuentan: los publicados en los últimos 30 días. */
const OUTBREAK_DAYS = 30;
/** Cortes de Cloudflare Radar que cuentan: los que siguen en curso o acabaron hace menos de 24 h. */
const RADAR_HOURS = 24;

export interface RiskSignals {
	counts: { red: number; orange: number; outages: number; outbreaks: number; level4: number | null };
	disasters: GdacsEvent[];
	outages: (IodaOutage & { country: string })[];
	outbreaks: OutbreakNews[];
	/** Cortes verificados por Cloudflare Radar, con su causa (complementan a IODA). */
	verified: (Pick<RadarOutage, 'id' | 'cause' | 'scope' | 'start' | 'end' | 'url'> & { country: string })[];
}

/** Nombre del país en español a partir del código ISO; si no se sabe, el que da la fuente. */
export function countryName(code: string, fallback: string): string {
	try {
		return new Intl.DisplayNames('es', { type: 'region' }).of(code) ?? fallback;
	} catch {
		return fallback;
	}
}

export function riskSignals(
	input: {
		gdacs?: GdacsEvent[] | null;
		ioda?: IodaOutage[] | null;
		radar?: RadarOutage[] | null;
		who?: OutbreakNews[] | null;
		advisories?: AdvisoriesData | null;
	},
	now: number,
	limit = 5
): RiskSignals {
	const gdacs = input.gdacs ?? [];
	const ioda = input.ioda ?? [];
	const radar = (input.radar ?? []).filter((o) => !o.end || Date.parse(o.end) >= now - RADAR_HOURS * 3_600_000);
	// Países sin internet: los de IODA y los de un corte de Cloudflare Radar que sigue en curso, sin repetir.
	const offline = new Set([...ioda.map((o) => o.code), ...radar.filter((o) => !o.end).flatMap((o) => o.codes)]);
	const outbreaks = (input.who ?? []).filter((o) => o.date && Date.parse(o.date) >= now - OUTBREAK_DAYS * DAY);
	const level4 = input.advisories ? levelCounts(input.advisories.items)[3] : null;
	return {
		counts: {
			red: gdacs.filter((e) => e.level === 'red').length,
			orange: gdacs.filter((e) => e.level === 'orange').length,
			outages: offline.size,
			outbreaks: outbreaks.length,
			level4
		},
		// Primero las rojas; dentro de cada nivel, la de más puntuación y, a igualdad, la más reciente.
		disasters: [...gdacs]
			.sort(
				(a, b) =>
					Number(b.level === 'red') - Number(a.level === 'red') ||
					(b.score ?? 0) - (a.score ?? 0) ||
					(b.updated ?? '').localeCompare(a.updated ?? '')
			)
			.slice(0, limit),
		// Primero las críticas; dentro de cada nivel, la que más ha caído.
		outages: [...ioda]
			.sort((a, b) => Number(b.level === 'critical') - Number(a.level === 'critical') || (b.drop ?? 0) - (a.drop ?? 0))
			.slice(0, limit)
			.map((o) => ({ ...o, country: countryName(o.code, o.name) })),
		outbreaks: outbreaks.slice(0, 3),
		verified: radar.slice(0, 3).map((o) => ({
			id: o.id,
			cause: o.cause,
			scope: o.scope,
			start: o.start,
			end: o.end,
			url: o.url,
			country: o.codes.map((c) => countryName(c, c)).join(', ') || 'Varios países'
		}))
	};
}

/** PAIS, fila «Riesgo»: lo que afecta a un país (solo lo que se pinta). */
export interface CountryRisk {
	disasters: Pick<GdacsEvent, 'id' | 'kind' | 'name' | 'level' | 'url'>[];
	outage: Pick<IodaOutage, 'level' | 'drop' | 'since' | 'url'> | null;
	outbreaks: Pick<OutbreakNews, 'id' | 'title' | 'date' | 'url'>[];
}

/**
 * Riesgos por país (código ISO de los países que conoce la terminal): catástrofes de GDACS (por el nombre
 * del país que da GDACS), caída de internet de IODA (por código) y brotes de la OMS de los últimos 30 días
 * (por el título del parte: «Cholera - Sudan»). Los países sin nada no salen.
 */
export function countryRisks(
	input: { gdacs?: GdacsEvent[] | null; ioda?: IodaOutage[] | null; who?: OutbreakNews[] | null },
	now: number
): Record<string, CountryRisk> {
	const out: Record<string, CountryRisk> = {};
	const of = (code: string) => (out[code] ??= { disasters: [], outage: null, outbreaks: [] });
	for (const e of input.gdacs ?? [])
		for (const c of findCountries(e.country)) of(c.code).disasters.push({ id: e.id, kind: e.kind, name: e.name, level: e.level, url: e.url });
	const known = new Set(COUNTRIES.map((c) => c.code));
	for (const o of input.ioda ?? [])
		if (known.has(o.code)) of(o.code).outage = { level: o.level, drop: o.drop, since: o.since, url: o.url };
	for (const o of input.who ?? []) {
		if (!o.date || Date.parse(o.date) < now - OUTBREAK_DAYS * DAY) continue;
		for (const c of findCountries(o.title)) of(c.code).outbreaks.push({ id: o.id, title: o.title, date: o.date, url: o.url });
	}
	return out;
}
