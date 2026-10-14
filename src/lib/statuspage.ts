// Estado de los grandes servicios de internet (static/data/statuspage.json, scripts/sources/statuspage.ts):
// los tipos que comparten la fuente y el panel de TECH, y cómo se resume cada servicio en verde, ámbar o rojo.

/** none = todo bien; minor/major/critical = incidencia; maintenance = mantenimiento programado. */
export type Indicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';

export interface ServiceIncident {
	id: string;
	name: string;
	impact: Indicator;
	/** Fase: investigating, identified, monitoring… (la de cada página, sin traducir). */
	status: string;
	started: string | null;
	updated: string | null;
	url: string;
}

export interface ServiceStatus {
	id: string;
	name: string;
	indicator: Indicator;
	/** Texto de la página, p. ej. «All Systems Operational». */
	description: string;
	incidents: ServiceIncident[];
	page: string;
	/** true si esta pasada no se pudo leer y es el estado de la vez anterior. */
	stale?: true;
}

/** Los que se ven primero en TECH, en este orden; los demás van detrás. */
export const MAIN_SERVICES = ['cloudflare', 'aws', 'gcp', 'm365', 'github', 'openai', 'anthropic'];

export const RANK: Record<Indicator, number> = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4 };

/** Verde: todo bien · ámbar: incidencia menor o mantenimiento · rojo: caída parcial o grave. */
export type Tone = 'ok' | 'warn' | 'bad';

export function tone(indicator: Indicator): Tone {
	const r = RANK[indicator] ?? 0;
	return r >= RANK.major ? 'bad' : r > 0 ? 'warn' : 'ok';
}

const LABELS: Record<Indicator, string> = {
	none: 'Operativo',
	maintenance: 'Mantenimiento',
	minor: 'Incidencia menor',
	major: 'Caída parcial',
	critical: 'Caída grave'
};

export const label = (indicator: Indicator) => LABELS[indicator] ?? LABELS.none;

/** Primero los principales en su orden; luego el resto, por nombre. */
export function sortServices(services: ServiceStatus[]): ServiceStatus[] {
	const pos = (s: ServiceStatus) => {
		const i = MAIN_SERVICES.indexOf(s.id);
		return i < 0 ? MAIN_SERVICES.length : i;
	};
	return [...services].sort((a, b) => pos(a) - pos(b) || a.name.localeCompare(b.name, 'es'));
}

/** La incidencia que se enseña: la más grave y, a igualdad, la más reciente. */
export function activeIncident(s: ServiceStatus): ServiceIncident | null {
	const sorted = [...(s.incidents ?? [])].sort(
		(a, b) => (RANK[b.impact] ?? 0) - (RANK[a.impact] ?? 0) || (b.updated ?? '').localeCompare(a.updated ?? '')
	);
	return sorted[0] ?? null;
}
