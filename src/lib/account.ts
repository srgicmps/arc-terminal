// «Tu cuenta» (fila de HELP, «A tu gusto»), la parte pura: adónde se va al salir y qué se borra de este navegador
// tras «Borrar mi cuenta». Lo que lo hace está en account.svelte.ts; el servidor, en cloud/account.ts.
import { MEMORY } from './cloud.ts';
import { PREFS } from './prefs.ts';

/** La salida de Cloudflare Access: borra su cookie y cierra la sesión. El service worker deja pasar /cdn-cgi/. */
export const LOGOUT = '/cdn-cgi/access/logout';

/** La caché del service worker con las vistas que has abierto (PAGES en src/service-worker/index.ts). */
export const PAGES = 'arc-pages';

/**
 * Las claves de localStorage que se borran tras «Borrar mi cuenta»: todas las que prefs.ts registra ahí (lo tuyo y
 * las cachés tuyas, como el tiempo de tu sitio, que dice dónde estás). La memoria de la sincronización no: pasa a
 * ser de nadie (NOBODY en cloud.ts), para que nada de lo que quede aquí suba a quien entre después. Las que no son de
 * Arc Terminal no se tocan.
 */
export const accountKeys = (keys: Iterable<string>): string[] =>
	[...keys].filter(
		(k) =>
			k !== MEMORY &&
			PREFS.some((p) => p.storage === 'local' && (p.key === k || (p.prefix !== undefined && k.startsWith(p.prefix))))
	);
