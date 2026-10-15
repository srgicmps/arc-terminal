// «Tu sitio»: qué es un sitio y las piezas sin estado (enlace, buscador, GPS, España o Menorca). El estado
// compartido está en place.svelte.ts; estas funciones van aparte para poder probarlas con Vitest.

export interface Place {
	name: string;
	/** País en español («España», «Japón»); vacío si no se sabe (ubicación del GPS o enlace). */
	country: string;
	/** Código ISO del país («ES», «JP»); vacío si no se sabe. */
	cc: string;
	/** Región y provincia, si las da el buscador («Islas Baleares», «Balears»). */
	admin1?: string;
	admin2?: string;
	lat: number;
	lon: number;
	/** Zona horaria IANA («Asia/Tokyo»); vacía hasta que Open-Meteo la diga. */
	tz: string;
}

/** Sitio de partida: Madrid (decisión de Sergi). */
export const DEFAULT_PLACE: Place = {
	name: 'Madrid',
	country: 'España',
	cc: 'ES',
	admin1: 'Comunidad de Madrid',
	admin2: 'Madrid',
	lat: 40.417,
	lon: -3.704,
	tz: 'Europe/Madrid'
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un sitio leído de fuera (localStorage, URL): solo si tiene nombre y coordenadas válidas. */
export function toPlace(v: unknown): Place | null {
	const o = v as Partial<Place> | null;
	if (!o || typeof o.name !== 'string' || !o.name.trim() || !finite(o.lat) || !finite(o.lon)) return null;
	if (Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180) return null;
	const str = (s: unknown) => (typeof s === 'string' ? s : '');
	return {
		name: o.name.trim().slice(0, 60),
		country: str(o.country),
		cc: str(o.cc).toUpperCase(),
		...(o.admin1 ? { admin1: str(o.admin1) } : {}),
		...(o.admin2 ? { admin2: str(o.admin2) } : {}),
		lat: o.lat,
		lon: o.lon,
		tz: str(o.tz)
	};
}

/** «?lugar=35.69,139.69,Tokio» → sitio (el nombre puede llevar comas). */
export function parsePlaceParam(param: string | null): Place | null {
	const [lat, lon, ...rest] = (param ?? '').split(',');
	return toPlace({
		name: rest.join(',') || 'Sitio compartido',
		lat: Number(lat),
		lon: Number(lon)
	});
}

/** Enlace para compartir el sitio: «?lugar=35.69,139.69,Tokio». */
export const placeParam = (p: Place) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)},${p.name}`;

/** Mismo sitio si las coordenadas coinciden a unos 100 m. */
export const samePlace = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;

// Zonas horarias que solo usa España (península y Baleares, Canarias, Ceuta y Melilla).
const SPAIN_TZ = ['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta'];

/** ¿Está en España? Por el país o, si no se sabe (GPS, enlace), por la zona horaria. */
export const inSpain = (p: Place) => p.cc === 'ES' || (!p.cc && SPAIN_TZ.includes(p.tz));

/** ¿Está en Menorca? Por coordenadas (la isla cabe en este recuadro). */
export const inMenorca = (p: Pick<Place, 'lat' | 'lon'>) => p.lat > 39.78 && p.lat < 40.11 && p.lon > 3.78 && p.lon < 4.35;

// ---------- Buscador de ciudades (Open-Meteo Geocoding, sin clave, desde el navegador) ----------

const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

/** Resultados del buscador convertidos en sitios. */
export function parseGeocoding(raw: unknown): Place[] {
	const results = (raw as { results?: unknown[] } | null)?.results;
	if (!Array.isArray(results)) return [];
	return results.flatMap((r) => {
		const o = r as Record<string, unknown>;
		const p = toPlace({
			name: o.name,
			country: o.country,
			cc: o.country_code,
			admin1: o.admin1,
			admin2: o.admin2,
			lat: o.latitude,
			lon: o.longitude,
			tz: o.timezone
		});
		return p ? [p] : [];
	});
}

/** Busca ciudades por nombre, en español. */
export async function searchPlaces(name: string, signal?: AbortSignal): Promise<Place[]> {
	const q = name.trim();
	if (q.length < 2) return [];
	const params = new URLSearchParams({
		name: q,
		count: '8',
		language: 'es',
		format: 'json'
	});
	const res = await fetch(`${GEOCODING}?${params}`, { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return parseGeocoding(await res.json());
}

/** Tu ubicación del GPS del navegador: no sale de él salvo las coordenadas que se piden a Open-Meteo. */
export function locate(): Promise<Place> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) return reject(new Error('Este navegador no da la ubicación'));
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				resolve({
					name: 'Mi ubicación',
					country: '',
					cc: '',
					// Redondeada a unos 100 m: de sobra para el tiempo y no guarda la casa exacta.
					lat: Math.round(pos.coords.latitude * 1000) / 1000,
					lon: Math.round(pos.coords.longitude * 1000) / 1000,
					tz: Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
				}),
			(err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Permiso denegado' : 'No se pudo ubicar')),
			{ maximumAge: 600_000, timeout: 10_000 }
		);
	});
}
