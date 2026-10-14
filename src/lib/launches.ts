// Próximos lanzamientos espaciales (Launch Library 2, The Space Devs). La forma de los datos la
// comparten el script (scripts/sources/launches.ts) y el panel de TECH; aquí van también las cuentas
// de la cuenta atrás, que son lógica pura y se pueden probar sin navegador.

export interface Launch {
	/** Identificador de Launch Library 2 (UUID). */
	id: string;
	/** Misión: «Starlink Group 10-5». */
	mission: string;
	/** Cohete: «Falcon 9». */
	rocket: string;
	/** Quién lanza: «SpaceX». */
	provider: string;
	/** Plataforma: «Space Launch Complex 40». */
	pad: string;
	/** Lugar: «Cape Canaveral SFS, FL, USA». */
	location: string;
	/** NET («no antes de»), ISO 8601 en UTC. */
	net: string;
	/** false si la fecha es aproximada (día, mes, trimestre…): entonces no se enseña la hora. */
	precise: boolean;
	windowStart: string | null;
	windowEnd: string | null;
	/** Estado abreviado: «Go», «TBD», «TBC», «Hold», «In Flight», «Success»… */
	status: string;
	/** Estado completo, para el title: «Go for Launch». */
	statusName: string;
	/** Webcast si lo hay; si no, la página oficial de la misión; si tampoco, null. */
	url: string | null;
	/** true si `url` es un webcast. */
	webcast: boolean;
}

export interface LaunchesData {
	/** Cuándo se consultó de verdad la API (no cambia si se reutiliza la copia tras un 429). */
	asOf: string;
	/** Si la última consulta dio 429 y se reutilizó la copia anterior: cuándo fue (ISO 8601). */
	limited?: string;
	launches: Launch[];
}

const HOUR = 3600_000;

/**
 * Hasta cuándo se considera «en curso» un lanzamiento cuyo NET ya pasó: el final de la ventana o,
 * si la ventana es instantánea o no se conoce, una hora después del NET.
 */
export function endOf(l: Pick<Launch, 'net' | 'windowEnd'>): number {
	const net = Date.parse(l.net);
	const end = l.windowEnd ? Date.parse(l.windowEnd) : NaN;
	return Math.max(net + HOUR, Number.isFinite(end) ? end : -Infinity);
}

/** Los lanzamientos que aún no han terminado a la hora `now`, por orden de NET. */
export function pending(launches: Launch[], now: number): Launch[] {
	return launches
		.filter((l) => Number.isFinite(Date.parse(l.net)) && now < endOf(l))
		.sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
}

/** El primero que aún no ha despegado. El que ya pasó su NET (en curso) se salta. */
export function nextLaunch(launches: Launch[], now: number): Launch | null {
	return pending(launches, now).find((l) => Date.parse(l.net) > now) ?? null;
}

/** Los que ya pasaron su NET pero siguen dentro de su ventana. */
export function inProgress(launches: Launch[], now: number): Launch[] {
	return pending(launches, now).filter((l) => Date.parse(l.net) <= now);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Milisegundos hasta el despegue → «T−2 d 04:13:20» (o «T−04:13:20» si falta menos de un día). */
export function countdown(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const d = Math.floor(s / 86_400);
	const hms = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
	return `T−${d ? `${d} d ` : ''}${hms}`;
}
