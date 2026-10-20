// Service worker: deja Arc Terminal instalado en el móvil y lo hace funcionar sin conexión
// con la última copia descargada. SvelteKit lo construye y lo registra solo.
//
// Estrategias:
// - Al instalar (precaché): el código que arranca las vistas (la lista que deja la build en
//   _app/precache.json, scripts/precache.ts), el manifest, los iconos y la portada TOP (la raíz y su
//   __data.json). Arc OS y lo que solo se carga con import() (estéticas, ventanas de Arc OS, globo…) no:
//   se guardan la primera vez que se piden, en una caché de nombre fijo con límite (arc-chunks). Si la
//   lista falta o es de otra publicación, se precachea todo _app/immutable, como antes.
// - Lo que ya estaba guardado con el mismo nombre (llevan un hash) no se vuelve a bajar al publicar.
// - Las demás vistas se guardan al abrirlas: primero la red y, si responde bien, una copia en la caché de
//   páginas. Esa caché tiene nombre fijo (sobrevive a las publicaciones) y un límite de entradas.
// - Sin conexión: la vista abierta antes sale de esa caché; una que nunca se abrió cae en TOP. Lo que solo
//   se carga con import() y nunca se usó con conexión (otra estética, una ventana de Arc OS) no está.
// - Letras: Plex e Inter vienen con la web (src/styles/fonts.css, en _app/immutable). No van en la precaché: se
//   guardan en arc-chunks al pedirlas, solo las de la estética que se usa. Las de Google (las demás estéticas),
//   primero la caché (no cambian nunca); al activarse, se borran de ahí las de Google que ya sirve la web.
// - Motor de ajedrez (static/engine/, unos 7 MB): no entra en la precaché, para no descargarlo a quien no
//   juega. Se guarda la primera vez que se usa, en una caché propia que sobrevive a las publicaciones.
// - Todo lo demás (widgets de TradingView incluidos) pasa directo a la red, sin guardar nada.
// - Cloudflare Access (arcterminal.dev): /cdn-cgi/ (login, callback, salida) nunca pasa por aquí, y las
//   páginas que acaban en el login (`redirected`) no se guardan. Si una petición falla porque la sesión
//   ha caducado (Access redirige al login de otro dominio y fetch da error), NO se sirve la copia vieja:
//   se responde 401 y se avisa a la página, que recarga y lleva al login. Solo sin red de verdad sale la copia.
import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { bootFiles, precacheable, servedByWeb } from './precache.ts';

// Archivos de la build: una caché por publicación; al publicar, `version` cambia y la anterior se borra.
const CACHE = `arc-${version}`;
// Vistas abiertas y sus datos: nombre fijo, nunca se borra al publicar.
const PAGES = 'arc-pages';
const PAGES_MAX = 40;
// Archivos de la build que no van en la precaché (Arc OS, import(), letras): se guardan al pedirlos. Nombre fijo;
// al publicar solo se quitan los que ya no están en la build. Hoy son unos 100: el límite es un seguro.
const CHUNKS = 'arc-chunks';
const CHUNKS_MAX = 150;
const FONTS = 'arc-fonts';
const ENGINE = 'arc-engine';

// El scope del SW es la carpeta de la web (la raíz). Las rutas del manifest son relativas a ella.
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;

const IMMUTABLE = immutable.map((f) => url(f.path));
const BUILD = new Set(IMMUTABLE);
/** Carpeta de los archivos con hash: también los de una publicación más nueva que este service worker. */
const IMMUTABLE_DIR = `${scope.pathname}_app/immutable/`;
/**
 * Al buscar un archivo de la build en la caché, sin mirar `Vary`: el servidor responde `Vary: Origin` y los
 * import de módulos llevan Origin y la precaché no, así que no casaban y se volvían a descargar. Con el hash en
 * el nombre, el contenido es siempre el mismo.
 */
const SAME_FILE = { ignoreVary: true };
/** La lista de la precaché que deja la build (scripts/precache.ts). */
const LIST = url('_app/precache.json');
/** JSON de datos: data/fuel.json, data/fuel/07.json, eco/__data.json… */
const DATA = /(\/data\/.+|__data)\.json$/;
/** De static/ solo el manifest, los iconos y el favicon (no los JSON de data/ ni las pantallas de arranque de iOS, que solo pide el iPhone al instalar). */
const STATIC = assets
	.map((f) => url(f.path))
	.filter((href) => /\.(webmanifest|png|svg|ico)$/.test(href) && !DATA.test(new URL(href).pathname) && !/\/splash-[^/]*$/.test(href));
/** Archivos del motor de ajedrez de esta publicación (static/engine/): lo demás de su caché sobra. */
const ENGINE_FILES = assets
	.map((f) => url(f.path))
	.filter((href) => new URL(href).pathname.startsWith(`${scope.pathname}engine/`));
/** La portada TOP y sus datos (si la build los genera): siempre disponibles sin conexión. */
const TOP_DATA = url('__data.json');
const TOP = [scope.href, ...(prerendered.some((f) => url(f.path) === TOP_DATA) ? [TOP_DATA] : [])];
/** Lo que nunca sale de la caché de páginas: TOP, el índice de la barra y el estado de las fuentes (los usan todas las vistas). */
const KEEP = [...TOP, url('data/search.json'), url('data/status.json')];

/** Lo que arranca las vistas, según la lista de la build; sin lista (o si falla), todo _app/immutable menos las letras. */
async function bootList(): Promise<string[]> {
	try {
		const response = await fetch(LIST, { cache: 'no-cache' });
		return bootFiles(response.ok && !response.redirected ? await response.json() : null, version, IMMUTABLE, url);
	} catch {
		return precacheable(IMMUTABLE);
	}
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Los archivos de _app/immutable llevan un hash en el nombre: si ya están en una caché
			// anterior (o en arc-chunks), se reutilizan en lugar de volver a descargarlos (ahorra datos en el móvil).
			const boot = await bootList();
			const missing: string[] = [];
			for (const href of [...boot, ...STATIC]) {
				const old = BUILD.has(href) ? await caches.match(href, SAME_FILE) : undefined;
				if (old) await cache.put(href, old);
				else missing.push(href);
			}
			await cache.addAll(missing);
			// Lo que no va en la precaché (Arc OS, import()) pero ya estaba guardado en la caché de la publicación
			// anterior pasa a arc-chunks: al activarse, esa caché se borra y se perdería.
			const chunks = await caches.open(CHUNKS);
			const listed = new Set(boot);
			for (const href of IMMUTABLE) {
				if (listed.has(href) || (await chunks.match(href, SAME_FILE))) continue;
				const old = await caches.match(href, SAME_FILE);
				if (old) await chunks.put(href, old);
			}
			await prune(chunks, CHUNKS_MAX);
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
	// Aparte y sin fallar: si la limpieza de letras va mal, el service worker se activa igual.
	event.waitUntil(dropServedFonts().catch(() => undefined));
	event.waitUntil(
		(async () => {
			// Se borran las cachés de publicaciones viejas, pero nunca la de páginas, la de trozos, la de fuentes ni la del motor.
			for (const key of await caches.keys()) {
				if (![CACHE, PAGES, CHUNKS, FONTS, ENGINE].includes(key)) await caches.delete(key);
			}
			// Del motor, solo los archivos de esta publicación: si cambia de versión, el viejo (7 MB) se borra.
			const engine = await caches.open(ENGINE);
			for (const request of await engine.keys()) if (!ENGINE_FILES.includes(request.url)) await engine.delete(request);
			// De los trozos, igual: lo que ya no está en la build no se volverá a pedir.
			const chunks = await caches.open(CHUNKS);
			for (const request of await chunks.keys()) if (!BUILD.has(request.url)) await chunks.delete(request);
			await self.clients.claim();
		})()
	);
});

/**
 * De la caché de letras de Google (arc-fonts), fuera las que ya sirve la web (Plex Mono, Plex Sans Condensed e
 * Inter): nadie las volverá a pedir. Las de las demás estéticas se quedan.
 */
async function dropServedFonts() {
	if (!(await caches.has(FONTS))) return;
	const fonts = await caches.open(FONTS);
	for (const request of await fonts.keys()) if (servedByWeb(request.url)) await fonts.delete(request);
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const target = new URL(request.url);

	// Fuentes de Google (las demás letras de las estéticas): cache-first.
	if (target.hostname === 'fonts.googleapis.com' || target.hostname === 'fonts.gstatic.com') {
		event.respondWith(cacheFirst(request));
		return;
	}

	// Solo nos ocupamos de lo nuestro; TradingView y demás terceros van directos a la red.
	if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;

	// Tus ajustes (/api/prefs): siempre a la red, nunca de la caché.
	if (target.pathname.startsWith(`${scope.pathname}api/`)) return;
	// Login y salida de Cloudflare Access: siempre a la red, sin tocar.
	if (target.pathname.startsWith('/cdn-cgi/')) return;

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

	// Archivos de la build (llevan un hash en el nombre): de la precaché o de arc-chunks; si no, de la red y se guardan.
	// También los de una publicación más nueva que este service worker (la página ya es la nueva y el suyo aún
	// se instala): así no se pierde lo que solo se carga con import() en esa primera visita.
	// Sin el #fragmento: <use href="…/land.svg#land"> (el contorno de los mapas) lo lleva en la URL de la petición.
	// La Cache API ya lo ignora al buscar, pero las listas (STATIC) comparan la URL entera.
	target.hash = '';
	if (target.pathname.startsWith(IMMUTABLE_DIR)) {
		event.respondWith(chunk(request));
		return;
	}

	// Manifest, iconos y favicon: de la precaché. El resto de archivos propios, a la red.
	if (STATIC.includes(target.href)) {
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
			await prune(cache, PAGES_MAX, KEEP);
		}
		return response;
	} catch (error) {
		if (await loginNeeded()) return expired();
		const cached = await cache.match(key(request));
		if (cached) return cached;
		throw error;
	}
}

/**
 * ¿Ha fallado porque la sesión de Access ha caducado? Se pide la portada sin seguir redirecciones: si
 * responde con una redirección (al login), sí; si da 200, el fallo era otro; si no hay red, tampoco.
 */
async function loginNeeded(): Promise<boolean> {
	try {
		const probe = await fetch(scope.href, { redirect: 'manual', cache: 'no-store', credentials: 'include' });
		return probe.type === 'opaqueredirect' || (probe.status >= 300 && probe.status < 400);
	} catch {
		return false;
	}
}

/** Sesión caducada: se avisa a las pestañas abiertas (recargan y van al login) y no se da ninguna copia. */
async function expired(): Promise<Response> {
	for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'access-login' });
	return new Response(null, { status: 401, statusText: 'Login needed' });
}

/**
 * Deja una caché en `max` entradas, borrando las más antiguas. `put` vuelve a poner al final lo que ya
 * estaba, así que en la de páginas el orden de `keys()` es el de la última visita. Lo de `keep` (KEEP) no se
 * borra nunca.
 */
async function prune(cache: Cache, max: number, keep: string[] = []) {
	const keys = (await cache.keys()).filter((r) => !keep.includes(r.url));
	for (const old of keys.slice(0, Math.max(0, keys.length - (max - keep.length)))) await cache.delete(old);
}

/**
 * Archivos de la build: de la precaché o de arc-chunks; si no están (Arc OS, import()), de la red, y se
 * guardan en arc-chunks para la próxima vez y para usarlos sin conexión. Si falla porque la sesión de Access
 * ha caducado, se avisa a la página, como en networkFirst.
 */
async function chunk(request: Request): Promise<Response> {
	const cached = (await caches.match(request, { ...SAME_FILE, cacheName: CACHE })) ?? (await caches.match(request, { ...SAME_FILE, cacheName: CHUNKS }));
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok && !response.redirected) {
			const cache = await caches.open(CHUNKS);
			await cache.put(request, response.clone());
			await prune(cache, CHUNKS_MAX);
		}
		return response;
	} catch (error) {
		if (await loginNeeded()) return expired();
		throw error;
	}
}

/** Páginas: red primero; sin red, la página guardada o, si nunca se abrió, la portada. */
async function page(request: Request): Promise<Response> {
	try {
		const response = await networkFirst(request);
		// Sesión caducada en una navegación: a la portada, que Access redirige al login.
		if (response.status === 401 && response.statusText === 'Login needed') return Response.redirect(scope.href, 302);
		return response;
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
