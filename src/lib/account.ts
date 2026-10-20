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

/** Lo de la cuenta borrada, fuera de este navegador (accountKeys) y de esta pestaña (sessionStorage, entero). */
export function wipe(local: Pick<Storage, 'length' | 'key' | 'removeItem'>, session: Pick<Storage, 'clear'>) {
	const keys = Array.from({ length: local.length }, (_, i) => local.key(i) ?? '');
	for (const k of accountKeys(keys)) local.removeItem(k);
	session.clear();
}

/** El final de los avisos de «Borrar mi cuenta» cuando seguro que no se ha borrado nada. */
export const KEPT = 'No se ha borrado nada.';

const AGAIN = 'Vuelve a pulsar «Borrar para siempre»: si ya estaba borrada, no pasa nada.';

/** Lo que importa de la respuesta del DELETE. null: no ha llegado (fetch ha fallado: sin red, el móvil se ha dormido…). */
export type Reply = Pick<Response, 'ok' | 'status' | 'type'> | null;

/** Qué hacer tras «Borrar mi cuenta»: salir, o un aviso y si la pestaña sigue sin sincronizar (held). */
export type Outcome = { done: true } | { done: false; held: boolean; msg: string };

/**
 * El resultado del DELETE /api/account. Si ha ido bien, se sale. Si no ha llegado la respuesta, no se sabe si el
 * servidor lo ha borrado: la pestaña sigue sin sincronizar (subir ahora recrearía la cuenta) y se pide volver a
 * pulsar, porque repetir el DELETE no hace daño (si ya no hay nada, responde bien igual). Mientras quede esa duda
 * (unsure: un intento anterior sin respuesta), ningún aviso dice «No se ha borrado nada»: solo cuando el servidor
 * responde con un error al primer intento.
 */
export function deleteOutcome(res: Reply, unsure: boolean): Outcome {
	if (res?.ok) return { done: true };
	if (!res)
		return { done: false, held: true, msg: `No ha llegado la respuesta y no se sabe si se ha borrado. ${AGAIN}` };
	const expired = res.type === 'opaqueredirect' || res.status === 401;
	if (unsure)
		return {
			done: false,
			held: true,
			msg: expired
				? 'Tu sesión ha caducado y no se sabe si se ha borrado: recarga la página y vuelve a borrarla.'
				: `No se ha podido comprobar si se ha borrado. ${AGAIN}`
		};
	return {
		done: false,
		held: false,
		msg: expired
			? `Tu sesión ha caducado: recarga la página y vuelve a probar. ${KEPT}`
			: `No se ha podido borrar: vuelve a probar en un rato. ${KEPT}`
	};
}

/** Sin conexión antes de enviar: no sale nada, pero si un intento anterior se quedó sin respuesta, la duda sigue. */
export const offlineMsg = (unsure: boolean): string =>
	unsure
		? 'Sin conexión, y aún no se sabe si se ha borrado: vuelve a pulsar «Borrar para siempre» cuando vuelva.'
		: `Sin conexión. ${KEPT}`;
