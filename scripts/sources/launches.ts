// Próximos lanzamientos espaciales: Launch Library 2 (The Space Devs), sin clave.
// https://ll.thespacedevs.com/docs/ · Términos: uso gratuito con atribución a The Space Devs.
//
// ⚠ El plan gratuito permite 15 peticiones por hora y por IP, y las Actions de GitHub comparten IP con
// otros repos. Por eso: una sola petición cada 6 h (maxAgeMinutes), sin reintentos, y si la API
// responde 429 (límite superado) se reutiliza la copia anterior con su fecha en vez de fallar: así la
// siguiente consulta vuelve a esperar 6 h y no se insiste contra el límite cada 15 min.
import type { Launch, LaunchesData } from '../../src/lib/launches.ts';
import { request, type Source } from '../lib.ts';

const URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=normal';
const KEEP = 8;

interface Named {
	name?: string | null;
	abbrev?: string | null;
}

interface RawLink {
	url?: string | null;
	priority?: number | null;
}

/** Lo que se usa de cada lanzamiento de /launches/upcoming/ (modo normal). */
export interface RawLaunch {
	id: string;
	name?: string | null;
	net?: string | null;
	net_precision?: Named | null;
	window_start?: string | null;
	window_end?: string | null;
	status?: Named | null;
	launch_service_provider?: Named | null;
	rocket?: { configuration?: { name?: string | null; full_name?: string | null } | null } | null;
	mission?: { name?: string | null } | null;
	pad?: { name?: string | null; location?: { name?: string | null } | null } | null;
	// La 2.3.0 los llama en snake_case; la 2.2.0, vidURLs e infoURLs. Se aceptan los dos.
	vid_urls?: RawLink[] | null;
	vidURLs?: RawLink[] | null;
	info_urls?: RawLink[] | null;
	infoURLs?: RawLink[] | null;
}

/** Precisiones del NET que permiten enseñar la hora (segundo, minuto, hora). */
const PRECISE = new Set(['SEC', 'MIN', 'HR']);

const text = (s: string | null | undefined) => (s ?? '').trim();

/** El enlace de más prioridad (la API da 0 o 1 como la mejor; null va al final). */
function best(links: RawLink[] | null | undefined): string | null {
	const ok = (links ?? []).filter((l) => l.url && /^https?:\/\//.test(l.url));
	ok.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
	return ok[0]?.url ?? null;
}

const iso = (s: string | null | undefined) => {
	const t = s ? Date.parse(s) : NaN;
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Un lanzamiento de la API → Launch. Sin NET válido no sirve para nada: null. */
export function toLaunch(raw: RawLaunch): Launch | null {
	const net = iso(raw.net);
	if (!raw.id || !net) return null;
	// «Falcon 9 Block 5 | Starlink Group 10-5»: si falta algún campo, se saca del nombre.
	const [fromName, missionFromName] = text(raw.name).split(' | ');
	const precision = raw.net_precision?.abbrev;
	const video = best(raw.vid_urls ?? raw.vidURLs);
	return {
		id: raw.id,
		mission: text(raw.mission?.name) || text(missionFromName) || text(raw.name),
		rocket: text(raw.rocket?.configuration?.name) || text(raw.rocket?.configuration?.full_name) || text(fromName),
		provider: text(raw.launch_service_provider?.name),
		pad: text(raw.pad?.name),
		location: text(raw.pad?.location?.name),
		net,
		precise: !precision || PRECISE.has(precision),
		windowStart: iso(raw.window_start),
		windowEnd: iso(raw.window_end),
		status: text(raw.status?.abbrev) || 'TBD',
		statusName: text(raw.status?.name),
		url: video ?? best(raw.info_urls ?? raw.infoURLs),
		webcast: !!video
	};
}

/** Respuesta de la API → los KEEP próximos, por orden de NET. */
export function parseLaunches(body: { results?: RawLaunch[] }): Launch[] {
	return (body.results ?? [])
		.map(toLaunch)
		.filter((l): l is Launch => l !== null)
		.sort((a, b) => Date.parse(a.net) - Date.parse(b.net))
		.slice(0, KEEP);
}

export const launches: Source<LaunchesData> = {
	name: 'launches',
	label: 'Próximos lanzamientos espaciales · Launch Library 2 (The Space Devs)',
	// 15 peticiones/hora por IP compartida: una cada 6 h, de sobra para un calendario de lanzamientos.
	maxAgeMinutes: 360,
	async fetch(previous) {
		let res: Response;
		try {
			// Un solo intento: reintentar gasta peticiones del límite.
			res = await request(URL, { headers: { Accept: 'application/json' } }, 1);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// 429: límite superado. Con copia anterior, se reutiliza (marcada) en vez de fallar.
			if (message.startsWith('HTTP 429') && previous?.launches?.length) {
				console.log(`  launches: ${message}; se reutiliza la copia de ${previous.asOf}`);
				return { ...previous, limited: new Date().toISOString() };
			}
			throw error;
		}
		return { asOf: new Date().toISOString(), launches: parseLaunches(await res.json()) };
	}
};
