// Qué guarda el service worker al instalarse (y qué letras de Google sobran). Lógica pura (sin cachés ni fetch)
// para poder probarla.

/** build/_app/precache.json (scripts/precache.ts): la versión de la build y lo que arranca las vistas. */
export interface PrecacheList {
	version: string;
	/** Rutas relativas a la raíz: «_app/immutable/entry/start.X.js». */
	files: string[];
}

/**
 * Letras (src/styles/fonts.css, unos 260 KB entre todas): nunca en la precaché. Cada estética usa unas pocas y
 * el navegador solo pide esas; el service worker las guarda al pedirlas (arc-chunks), como lo que va con import().
 */
const FONT = /\.woff2$/;

/** De los archivos de la build, los que pueden ir en la precaché: todos menos las letras. */
export function precacheable(immutable: string[]): string[] {
	return immutable.filter((href) => !FONT.test(href));
}

/**
 * De los archivos de la build (`immutable`, URL completas), los que van a la precaché: los de la lista, si es de
 * esta misma publicación. Si la lista falta, es de otra publicación o no casa con ningún archivo, todos menos las
 * letras (como antes): mejor descargar de más que dejar una vista sin su código.
 */
export function bootFiles(list: unknown, version: string, immutable: string[], url: (path: string) => string): string[] {
	const code = precacheable(immutable);
	const l = list as Partial<PrecacheList> | null;
	if (!l || l.version !== version || !Array.isArray(l.files)) return code;
	const wanted = new Set(l.files.filter((f): f is string => typeof f === 'string').map(url));
	const picked = code.filter((href) => wanted.has(href));
	return picked.length ? picked : code;
}

/** Familias que sirve la propia web (src/styles/fonts.css; el test lo comprueba). */
export const SERVED_FONTS = ['IBM Plex Mono', 'IBM Plex Sans Condensed', 'Inter'];
/** Su carpeta en fonts.gstatic.com: /s/ibmplexmono/v19/….woff2. */
const SERVED_DIRS = new Set(SERVED_FONTS.map((f) => f.toLowerCase().replace(/\s+/g, '')));

/**
 * ¿Es una petición a Google Fonts (su CSS o un woff2) de una letra que ya sirve la web? Esas sobran en arc-fonts:
 * son de antes o de una estética que las pedía. Un CSS con varias familias cuenta si nombra alguna, porque ninguna
 * estética las pide ya (estilos.test.ts) y esa URL no se volverá a usar. Las demás (Plex Sans, Inter Tight, VT323…), no.
 */
export function servedByWeb(href: string): boolean {
	const u = new URL(href);
	if (u.hostname === 'fonts.gstatic.com') return SERVED_DIRS.has(/^\/s\/([^/]+)\//.exec(u.pathname)?.[1] ?? '');
	if (u.hostname !== 'fonts.googleapis.com') return false;
	// css2?family=IBM+Plex+Mono:wght@400&family=Inter… (y la API vieja: css?family=Inter:400|Lato).
	const families = u.searchParams.getAll('family').flatMap((f) => f.split('|'));
	return families.some((f) => SERVED_FONTS.includes(f.split(':')[0].trim()));
}
