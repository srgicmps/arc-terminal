// «Borrar mi cuenta», de la fila «Tu cuenta» de HELP (AccountRow.svelte). Va aparte de cloud.svelte.ts, que carga en
// todas las vistas, para que solo lo descargue quien abre HELP; de allí usa hold, endSync y wipeHere. Lo puro, en
// account.ts; el servidor, en cloud/account.ts.
import { asset } from '$app/paths';
import { deleteOutcome, KEPT, LOGOUT, offlineMsg, PAGES } from './account.ts';
import { cloud, endSync, hold, wipeHere } from './cloud.svelte.ts';
import { PREFS } from './prefs.ts';

/**
 * Lo de este navegador, fuera, y a la salida de Access. Primero la memoria de la sincronización (endSync): así las
 * demás pestañas salen antes de ver nada a medio borrar, y quien entre después no recibe nada de lo que quede aquí.
 * Luego lo de localStorage y lo de esta pestaña (wipeHere, también lo que se escriba al salir), las bases de IndexedDB
 * de prefs.ts (las imágenes de fondo de Arc OS) y las vistas guardadas sin conexión.
 */
async function leave() {
	endSync();
	wipeHere();
	for (const p of PREFS) {
		if (p.storage !== 'idb') continue;
		try {
			indexedDB.deleteDatabase(p.key);
		} catch {}
	}
	if ('caches' in globalThis) await caches.delete(PAGES).catch(() => false);
	location.assign(LOGOUT);
}

/**
 * unsure: un DELETE se quedó sin respuesta, no se sabe si se ha borrado y la pestaña sigue sin sincronizar (hold) hasta
 * que se vuelva a pulsar o se recargue. Reactivo, como un ref() de Vue: la fila «Tu cuenta» lo dice mientras dure.
 */
export const account = $state({ unsure: false });

/** Lo que dice el navegador ahora (puede cambiar mientras se espera la respuesta). */
const online = () => navigator.onLine !== false;

/** El DELETE, con la confirmación (el email que ves en HELP). null si no llega la respuesta. */
async function send(user: string): Promise<Response | null> {
	try {
		return await fetch(asset('api/account' as Parameters<typeof asset>[0]), {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: user }),
			credentials: 'same-origin',
			redirect: 'manual'
		});
	} catch {
		return null;
	}
}

/**
 * Borra en el servidor todo lo tuyo (DELETE /api/account), luego lo de este navegador, y cierra la sesión. Mientras,
 * esta pestaña no sincroniza. Si sale bien, la página se va (null). Si no, devuelve el porqué: con un error del
 * servidor todo sigue igual; sin respuesta (tras un reintento) no se sabe si se ha borrado, así que la pestaña sigue
 * sin sincronizar hasta que se vuelva a pulsar o se recargue (deleteOutcome en account.ts).
 */
export async function deleteAccount(): Promise<string | null> {
	const user = cloud.user;
	if (!user) return `No hay cuenta. ${KEPT}`;
	if (!online()) return offlineMsg(account.unsure);
	// Con la duda de antes, la pestaña ya está parada: no hay que esperar a nada.
	const resume = account.unsure ? null : await hold();
	if (!account.unsure && !resume) return `Se están guardando tus cambios: vuelve a probar en un momento. ${KEPT}`;
	let res = await send(user);
	// El primer envío sin respuesta pudo llegar y borrarlo: la duda sigue aunque el reintento dé un error.
	const lost = !res;
	// Un corte suelto (el móvil pasa de wifi a datos): un reintento a los 2 s antes de dejar la duda.
	if (!res && online()) {
		await new Promise((r) => setTimeout(r, 2000));
		res = await send(user);
	}
	const out = deleteOutcome(res, account.unsure || lost);
	if (out.done) {
		account.unsure = false;
		await leave();
		return null;
	}
	account.unsure = out.held;
	if (!out.held) resume?.();
	return out.msg;
}
