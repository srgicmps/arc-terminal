// Service worker: deja Arc Terminal instalado en el móvil y lo hace funcionar sin conexión
// con la última copia descargada. SvelteKit lo construye y lo registra solo.
//
// Estrategias:
// - Archivos de la build, de static/ y páginas prerenderizadas: se guardan al instalar (precaché).
// - Navegación y data/*.json: primero la red (datos frescos); si no hay red, la copia guardada.
// - Fuentes de Google: primero la caché (no cambian nunca).
// - Todo lo demás (widgets de TradingView incluidos) pasa directo a la red, sin guardar nada.
import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// Una caché por publicación: al publicar, `version` cambia y la anterior se borra.
const CACHE = `arc-${version}`;
const FONTS = 'arc-fonts';

// La web vive en /arc-terminal/; el scope del SW es esa carpeta. Las rutas del manifest
// son relativas a ella.
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;

const IMMUTABLE = immutable.map((f) => url(f.path));
const PRECACHE = [...IMMUTABLE, ...assets.map((f) => url(f.path)), ...prerendered.map((f) => url(f.path))];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Los archivos de _app/immutable llevan un hash en el nombre: si ya están en una caché
			// anterior, se reutilizan en lugar de volver a descargarlos (ahorra datos en el móvil).
			const missing: string[] = [];
			for (const href of PRECACHE) {
				const old = IMMUTABLE.includes(href) ? await caches.match(href) : undefined;
				if (old) await cache.put(href, old);
				else missing.push(href);
			}
			await cache.addAll(missing);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE && key !== FONTS) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const target = new URL(request.url);

	// Fuentes de Google: cache-first.
	if (target.hostname === 'fonts.googleapis.com' || target.hostname === 'fonts.gstatic.com') {
		event.respondWith(cacheFirst(request));
		return;
	}

	// Solo nos ocupamos de lo nuestro; TradingView y demás terceros van directos a la red.
	if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;

	if (request.mode === 'navigate') {
		event.respondWith(page(request));
		return;
	}

	if (/\/data\/[^/]+\.json$/.test(target.pathname)) {
		event.respondWith(networkFirst(request));
		return;
	}

	// El resto de archivos propios: si está en la precaché, al instante; si no, a la red.
	if (PRECACHE.includes(target.href)) {
		event.respondWith(cacheFirst(request, CACHE));
	}
});

/** Red primero; si responde bien, se guarda la copia. Sin red, la copia guardada. */
async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) await cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;
		throw error;
	}
}

/** Páginas: red primero; sin red, la página guardada o, como último recurso, la portada. */
async function page(request: Request): Promise<Response> {
	try {
		return await networkFirst(request);
	} catch (error) {
		const path = new URL(request.url).pathname;
		// GitHub Pages sirve /eco y /eco/ igual: probamos las dos formas.
		const alt = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
		const cached =
			(await caches.match(new URL(alt, scope).href, { ignoreSearch: true })) ??
			(await caches.match(scope.href));
		if (cached) return cached;
		throw error;
	}
}

/** Caché primero; si no está, se descarga y se guarda. */
async function cacheFirst(request: Request, name = FONTS): Promise<Response> {
	const cache = await caches.open(name);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	// Las fuentes llegan como respuestas «opaque» (status 0) en algunos navegadores: también valen.
	if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
	return response;
}
