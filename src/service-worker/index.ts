// Service worker: deja Arc Terminal instalado en el móvil y lo hace funcionar sin conexión
// con la última copia descargada. SvelteKit lo construye y lo registra solo.
//
// Estrategias:
// - Al instalar (precaché) solo lo imprescindible: los archivos de la build (_app/immutable), el manifest,
//   los iconos y la portada TOP (la raíz y su __data.json). Así una publicación nueva no vuelve a bajar
//   todas las vistas con sus datos: en el móvil eran ~0,5 MB cada 15 min.
// - Las demás vistas se guardan al abrirlas: primero la red y, si responde bien, una copia en la caché de
//   páginas. Esa caché tiene nombre fijo (sobrevive a las publicaciones) y un límite de entradas.
// - Sin conexión: la vista abierta antes sale de esa caché; una que nunca se abrió cae en TOP.
// - Fuentes de Google: primero la caché (no cambian nunca).
// - Motor de ajedrez (static/engine/, unos 7 MB): no entra en la precaché, para no descargarlo a quien no
//   juega. Se guarda la primera vez que se usa, en una caché propia que sobrevive a las publicaciones.
// - Todo lo demás (widgets de TradingView incluidos) pasa directo a la red, sin guardar nada.
import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// Archivos de la build: una caché por publicación; al publicar, `version` cambia y la anterior se borra.
const CACHE = `arc-${version}`;
// Vistas abiertas y sus datos: nombre fijo, nunca se borra al publicar.
const PAGES = 'arc-pages';
const PAGES_MAX = 40;
const FONTS = 'arc-fonts';
const ENGINE = 'arc-engine';

// El scope del SW es la carpeta de la web (la raíz). Las rutas del manifest son relativas a ella.
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;

const IMMUTABLE = immutable.map((f) => url(f.path));
/** JSON de datos: data/fuel.json, data/fuel/07.json, eco/__data.json… */
const DATA = /(\/data\/.+|__data)\.json$/;
/** De static/ solo el manifest, los iconos y el favicon (no los JSON de data/). */
const STATIC = assets
	.map((f) => url(f.path))
	.filter((href) => /\.(webmanifest|png|svg|ico)$/.test(href) && !DATA.test(new URL(href).pathname));
const PRECACHE = [...IMMUTABLE, ...STATIC];
/** Archivos del motor de ajedrez de esta publicación (static/engine/): lo demás de su caché sobra. */
const ENGINE_FILES = assets
	.map((f) => url(f.path))
	.filter((href) => new URL(href).pathname.startsWith(`${scope.pathname}engine/`));
/** La portada TOP y sus datos (si la build los genera): siempre disponibles sin conexión. */
const TOP_DATA = url('__data.json');
const TOP = [scope.href, ...(prerendered.some((f) => url(f.path) === TOP_DATA) ? [TOP_DATA] : [])];

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
			// TOP siempre fresca: se salta la caché HTTP del navegador.
			const pages = await caches.open(PAGES);
			await Promise.all(
				TOP.map(async (href) => {
					const response = await fetch(href, { cache: 'no-cache' });
					if (!response.ok) throw new Error(`${href}: ${response.status}`);
					await pages.put(href, response);
				})
			);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Se borran las cachés de publicaciones viejas, pero nunca la de páginas, la de fuentes ni la del motor.
			for (const key of await caches.keys()) {
				if (key !== CACHE && key !== PAGES && key !== FONTS && key !== ENGINE) await caches.delete(key);
			}
			// Del motor, solo los archivos de esta publicación: si cambia de versión, el viejo (7 MB) se borra.
			const engine = await caches.open(ENGINE);
			for (const request of await engine.keys()) if (!ENGINE_FILES.includes(request.url)) await engine.delete(request);
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

	// Tus ajustes (/api/prefs): siempre a la red, nunca de la caché.
	if (target.pathname.startsWith(`${scope.pathname}api/`)) return;

	if (request.mode === 'navigate') {
		event.respondWith(page(request));
		return;
	}

	// Los archivos del motor llevan la versión en el nombre: si cambia, es otro archivo.
	if (target.pathname.startsWith(`${scope.pathname}engine/`)) {
		event.respondWith(cacheFirst(request, ENGINE));
		return;
	}

	// El archivo de titulares (NEWS) va directo a la red: cada mes pesa ~2 MB y ocuparía la caché de páginas.
	if (target.pathname.includes('/data/news-archive/')) return;

	if (DATA.test(target.pathname)) {
		event.respondWith(networkFirst(request));
		return;
	}

	// El resto de archivos propios: si está en la precaché, al instante; si no, a la red.
	if (PRECACHE.includes(target.href)) {
		event.respondWith(cacheFirst(request, CACHE));
	}
});

/** Sin búsqueda (?x-sveltekit-invalidated=…, ?q=…): una sola copia por vista. */
const key = (request: Request) => {
	const target = new URL(request.url);
	target.search = '';
	return target.href;
};

/** Red primero; si responde bien, se guarda la copia en la caché de páginas. Sin red, la copia guardada. */
async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(PAGES);
	try {
		const response = await fetch(request);
		if (response.ok && !response.redirected) {
			await cache.put(key(request), response.clone());
			await prune(cache);
		}
		return response;
	} catch (error) {
		const cached = await cache.match(key(request));
		if (cached) return cached;
		throw error;
	}
}

/**
 * Deja la caché de páginas en PAGES_MAX entradas, borrando las más antiguas. `put` vuelve a poner al
 * final lo que ya estaba, así que el orden de `keys()` es el de la última visita. TOP no se borra nunca.
 */
async function prune(cache: Cache) {
	const keys = (await cache.keys()).filter((r) => !TOP.includes(r.url));
	for (const old of keys.slice(0, Math.max(0, keys.length - (PAGES_MAX - TOP.length)))) await cache.delete(old);
}

/** Páginas: red primero; sin red, la página guardada o, si nunca se abrió, la portada. */
async function page(request: Request): Promise<Response> {
	try {
		return await networkFirst(request);
	} catch (error) {
		const path = new URL(request.url).pathname;
		// GitHub Pages sirve /eco y /eco/ igual: probamos las dos formas.
		const alt = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
		const pages = await caches.open(PAGES);
		const cached = (await pages.match(new URL(alt, scope).href)) ?? (await pages.match(scope.href));
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
