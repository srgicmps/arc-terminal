// «Cerrar sesión» y «Borrar mi cuenta» (HELP), la parte pura: qué se borra de este navegador al salir y adónde se va.
// Lo que lo hace está en signout.svelte.ts.
import { PREFS } from './prefs.ts';

/** La salida de Cloudflare Access: borra su cookie y cierra la sesión en todas sus aplicaciones. */
export const LOGOUT = '/cdn-cgi/access/logout';

/** La caché del service worker con las vistas que has abierto (PAGES en src/service-worker/index.ts). */
export const PAGES = 'arc-pages';

/**
 * Las claves de localStorage que se borran al salir: todas las que prefs.ts registra ahí. Lo tuyo vuelve solo al
 * entrar (está en la cuenta) y lo demás son cachés tuyas, como la memoria de la sincronización (sin ella, al volver a
 * entrar este navegador es como uno nuevo y manda la cuenta) o el tiempo de tu sitio (dice dónde estás). Las que no son
 * de Arc Terminal no se tocan.
 */
export const signOutKeys = (keys: Iterable<string>): string[] =>
	[...keys].filter((k) =>
		PREFS.some((p) => p.storage === 'local' && (p.key === k || (p.prefix !== undefined && k.startsWith(p.prefix))))
	);
