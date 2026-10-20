// Qué guarda el service worker al instalarse. Lógica pura (sin cachés ni fetch) para poder probarla.

/** build/_app/precache.json (scripts/precache.ts): la versión de la build y lo que arranca las vistas. */
export interface PrecacheList {
	version: string;
	/** Rutas relativas a la raíz: «_app/immutable/entry/start.X.js». */
	files: string[];
}

/**
 * Letras (src/styles/fonts.css, unos 330 KB entre todas): nunca en la precaché. Cada estética usa unas pocas y
 * el navegador solo pide esas; el service worker las guarda al pedirlas (arc-chunks), como lo que va con import().
 */
const FONT = /\.woff2$/;

/**
 * De los archivos de la build (`immutable`, URL completas), los que van a la precaché: los de la lista, si es de
 * esta misma publicación. Si la lista falta, es de otra publicación o no casa con ningún archivo, todos menos las
 * letras (como antes): mejor descargar de más que dejar una vista sin su código.
 */
export function bootFiles(list: unknown, version: string, immutable: string[], url: (path: string) => string): string[] {
	const code = immutable.filter((href) => !FONT.test(href));
	const l = list as Partial<PrecacheList> | null;
	if (!l || l.version !== version || !Array.isArray(l.files)) return code;
	const wanted = new Set(l.files.filter((f): f is string => typeof f === 'string').map(url));
	const picked = code.filter((href) => wanted.has(href));
	return picked.length ? picked : code;
}
