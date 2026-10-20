// «Borrar mi cuenta», de la fila «Tu cuenta» de HELP (AccountRow.svelte). Va aparte de cloud.svelte.ts, que carga en
// todas las vistas, para que solo lo descargue quien abre HELP; de allí usa hold y endSync. Lo puro, en account.ts;
// el servidor, en cloud/account.ts.
import { asset } from '$app/paths';
import { accountKeys, LOGOUT, PAGES } from './account.ts';
import { cloud, endSync, hold } from './cloud.svelte.ts';
import { PREFS } from './prefs.ts';

/**
 * Lo de este navegador, fuera, y a la salida de Access. Primero la memoria de la sincronización (endSync): así las
 * demás pestañas salen antes de ver nada a medio borrar, y quien entre después no recibe nada de lo que quede aquí.
 * Luego lo de localStorage (accountKeys), lo de esta pestaña, las bases de IndexedDB de prefs.ts (las imágenes de
 * fondo de Arc OS) y las vistas guardadas sin conexión.
 */
async function leave() {
	endSync();
	try {
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
		for (const k of accountKeys(keys)) localStorage.removeItem(k);
		sessionStorage.clear();
	} catch {}
	for (const p of PREFS) {
		if (p.storage !== 'idb') continue;
		try {
			indexedDB.deleteDatabase(p.key);
		} catch {}
	}
	if ('caches' in globalThis) await caches.delete(PAGES).catch(() => false);
	location.assign(LOGOUT);
}

const KEPT = 'No se ha borrado nada.';

/**
 * Borra en el servidor todo lo tuyo (DELETE /api/account), luego lo de este navegador, y cierra la sesión. Mientras,
 * esta pestaña no sincroniza. Si no se puede, devuelve el porqué y todo sigue igual; si sale bien, la página se va.
 */
export async function deleteAccount(): Promise<string | null> {
	if (!cloud.user) return `No hay cuenta. ${KEPT}`;
	if (navigator.onLine === false) return `Sin conexión. ${KEPT}`;
	const resume = await hold();
	if (!resume) return `Se están guardando tus cambios: vuelve a probar en un momento. ${KEPT}`;
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
		if (!res) return `Sin conexión. ${KEPT}`;
		if (res.type === 'opaqueredirect' || res.status === 401)
			return `Tu sesión ha caducado: recarga la página y vuelve a probar. ${KEPT}`;
		return `No se ha podido borrar: vuelve a probar en un rato. ${KEPT}`;
	}
	await leave();
	return null;
}
