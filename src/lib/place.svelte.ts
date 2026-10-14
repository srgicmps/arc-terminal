// «Tu sitio»: la ciudad que cada uno elige para el tiempo, el aire, el sol y el reloj (comando LUGAR o el chip
// de la cabecera). Se guarda en este navegador junto con hasta 5 favoritos, y también puede llegar por la URL
// (?lugar=35.69,139.69,Tokio) para compartir un enlace. Es como un store de Pinia con persistencia: si el
// navegador no deja guardar (modo privado…), sigue en memoria. Las piezas sin estado están en place.ts.
import { DEFAULT_PLACE, parsePlaceParam, samePlace, toPlace, type Place } from './place.ts';

export * from './place.ts';

const KEY = 'arc-place';
const MAX_FAVORITES = 5;

export const place = $state({
	current: DEFAULT_PLACE,
	favorites: [] as Place[],
	ready: false
});

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify({ current: place.current, favorites: place.favorites }));
	} catch {}
}

/** Se llama una vez al arrancar en el navegador (desde el layout). La URL manda sobre lo guardado. */
export function initPlace() {
	if (place.ready) return;
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		place.current = toPlace(saved?.current) ?? DEFAULT_PLACE;
		if (Array.isArray(saved?.favorites)) {
			place.favorites = saved.favorites
				.map(toPlace)
				.filter((p: Place | null): p is Place => p !== null)
				.slice(0, MAX_FAVORITES);
		}
	} catch {}
	const shared = parsePlaceParam(new URLSearchParams(location.search).get('lugar'));
	if (shared) setPlace(shared);
	place.ready = true;
}

/** Cambia de sitio y lo guarda. */
export function setPlace(p: Place) {
	place.current = p;
	save();
}

/** Completa el sitio con lo que dice Open-Meteo (la zona horaria), sin cambiar de sitio. */
export function learnTimezone(p: Place, tz: string) {
	if (!tz || p.tz === tz || !samePlace(place.current, p)) return;
	place.current = { ...place.current, tz };
	save();
}

export const isFavorite = (p: Place) => place.favorites.some((f) => samePlace(f, p));

/** Añade o quita de favoritos (máximo 5: al pasar, sale el más antiguo). */
export function toggleFavorite(p: Place) {
	place.favorites = isFavorite(p)
		? place.favorites.filter((f) => !samePlace(f, p))
		: [...place.favorites, p].slice(-MAX_FAVORITES);
	save();
}
