// GEO, «Señales de riesgo»: lo más grave de hoy con datos que ya se descargan (GDACS, IODA, OMS y avisos de
// viaje de EE. UU.). Lógica pura, con tests: el +page.server.ts la llama y al navegador llega solo esto.
import { levelCounts } from './advisories.ts';
import type { AdvisoriesData, GdacsEvent, IodaOutage, OutbreakNews } from './types.ts';

const DAY = 86_400_000;
/** Brotes de la OMS que cuentan: los publicados en los últimos 30 días. */
const OUTBREAK_DAYS = 30;

export interface RiskSignals {
	counts: { red: number; orange: number; outages: number; outbreaks: number; level4: number | null };
	disasters: GdacsEvent[];
	outages: (IodaOutage & { country: string })[];
	outbreaks: OutbreakNews[];
}

/** Nombre del país en español a partir del código ISO; si no se sabe, el que da la fuente. */
function countryName(code: string, fallback: string): string {
	try {
		return new Intl.DisplayNames('es', { type: 'region' }).of(code) ?? fallback;
	} catch {
		return fallback;
	}
}

export function riskSignals(
	input: { gdacs?: GdacsEvent[] | null; ioda?: IodaOutage[] | null; who?: OutbreakNews[] | null; advisories?: AdvisoriesData | null },
	now: number,
	limit = 5
): RiskSignals {
	const gdacs = input.gdacs ?? [];
	const ioda = input.ioda ?? [];
	const outbreaks = (input.who ?? []).filter((o) => o.date && Date.parse(o.date) >= now - OUTBREAK_DAYS * DAY);
	const level4 = input.advisories ? levelCounts(input.advisories.items)[3] : null;
	return {
		counts: {
			red: gdacs.filter((e) => e.level === 'red').length,
			orange: gdacs.filter((e) => e.level === 'orange').length,
			outages: ioda.length,
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
		outbreaks: outbreaks.slice(0, 3)
	};
}
