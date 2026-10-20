// «Cerrar sesión» y «Borrar mi cuenta», del panel «Tu cuenta» de HELP (AccountPanel.svelte); lo puro, en signout.ts.
// Va aparte de cloud.svelte.ts, que carga en todas las vistas, para que solo lo descargue quien abre HELP; de allí usa
// settle, hold y endSync. El servidor, en cloud/account.ts.
import { asset } from '$app/paths';
import { cloud, endSync, hold, settle } from './cloud.svelte.ts';
import { PREFS } from './prefs.ts';
import { LOGOUT, PAGES, signOutKeys } from './signout.ts';

/** Por qué no se ha podido salir. force: se puede salir igual, perdiendo lo que no ha llegado a la cuenta. */
export interface Blocked {
	text: string;
	force?: boolean;
}

/**
 * Borra de este navegador lo que es de la cuenta y va a la salida de Access: lo de localStorage (signOutKeys en
 * signout.ts), lo de esta pestaña, las bases de IndexedDB de prefs.ts y las vistas guardadas sin conexión. Al volver a
 * entrar, todo baja de la cuenta.
 */
async function leave() {
	endSync();
	try {
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
		for (const k of signOutKeys(keys)) localStorage.removeItem(k);
		sessionStorage.clear();
	} catch {}
	for (const p of PREFS.filter((p) => p.storage === 'idb')) {
		try {
			indexedDB.deleteDatabase(p.key);
		} catch {}
	}
	if ('caches' in globalThis) await caches.delete(PAGES).catch(() => false);
	location.assign(LOGOUT);
}

/**
 * «Cerrar sesión»: sube lo que quede por subir y sale. Sin conexión no se puede cerrar la sesión de Access, y si algo
 * no ha llegado a la cuenta se avisa antes (con force, se sale igual). En esos casos no se borra nada.
 */
export async function signOut(force = false): Promise<Blocked | null> {
	if (navigator.onLine === false) return { text: 'Sin conexión: vuelve a probar cuando tengas red.' };
	if ((await settle(true)) && !force)
		return { text: 'Hay cosas de este dispositivo que no están en tu cuenta: si sales, se pierden.', force: true };
	await leave();
	return null;
}

/**
 * «Borrar mi cuenta»: borra en el servidor todo lo tuyo (DELETE /api/account) y sale como «Cerrar sesión». Mientras,
 * esta pestaña no sube nada (lo recrearía). Si no se puede, devuelve el porqué y todo sigue igual.
 */
export async function deleteAccount(): Promise<Blocked | null> {
	if (!cloud.user) return { text: 'No hay cuenta.' };
	const resume = hold();
	await settle(false);
	let res: Response | null = null;
	try {
		res = await fetch(asset('api/account' as Parameters<typeof asset>[0]), {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: cloud.user }),
			credentials: 'same-origin',
			redirect: 'manual'
		});
	} catch {}
	if (!res?.ok) {
		resume();
		if (!res) return { text: 'Sin conexión: no se ha borrado nada.' };
		if (res.type === 'opaqueredirect' || res.status === 401)
			return { text: 'Tu sesión ha caducado: recarga la página y vuelve a probar. No se ha borrado nada.' };
		return { text: 'No se ha podido borrar: vuelve a probar en un rato. No se ha borrado nada.' };
	}
	await leave();
	return null;
}
