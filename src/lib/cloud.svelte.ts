// Ajustes en tu cuenta, en el navegador (la lógica, en cloud.ts; el servidor, en cloud/prefs.ts).
// localStorage sigue siendo donde lee y escribe cada módulo, como siempre: esto solo lo copia al servidor y
// trae lo de tus otros dispositivos. Sin servidor (GitHub Pages, sin conexión, en local), no hace nada.
import { asset } from '$app/paths';
import { collect } from './transfer.ts';
import { PREFS } from './prefs.ts';
import { isEmpty, mergeFitting, readMemory, startPlan, type Patch, type Prefs, type SyncMemory } from './cloud.ts';

const MEMORY = 'arc-sync';
const RELOADED = 'arc-sync-reload';
const EVERY = 5000;
const RETRY = 60_000;

/**
 * Cómo va la cuenta. user: con qué cuenta se guardan tus ajustes ('' si no hay servidor). state:
 *   local    sin servidor (en local, GitHub Pages): todo se queda en este navegador
 *   sync     conectando · ok: sincronizado · offline: sin conexión · auth: la sesión ha caducado
 *   error    el servidor ha fallado o ha rechazado los cambios
 * En todos los casos se sigue guardando aquí y se sube en cuanto se pueda. frozen: claves que no caben en la cuenta.
 */
export const cloud = $state({
	user: '',
	state: 'local' as 'local' | 'sync' | 'ok' | 'offline' | 'auth' | 'error',
	frozen: [] as string[]
});

/** Bases de IndexedDB de prefs.ts (las imágenes de fondo de Arc OS): son del usuario que estaba antes. */
const IDB = PREFS.filter((p) => p.storage === 'idb').map((p) => p.key);

let memory: SyncMemory | null = null;
let busy = false;
/** Esta pestaña ha llegado a tener la memoria guardada en localStorage (la ha leído o escrito). */
let stored = false;
/** Esta pestaña ya no sincroniza: se cierra la sesión o se borra la cuenta, aquí o en otra pestaña. */
let stopped = false;

const url = () => asset('api/prefs' as Parameters<typeof asset>[0]);

/** El estado según la respuesta: con Access, una sesión caducada llega como redirección (opaca) o como 401. */
const failed = (res: Response) =>
	(cloud.state =
		res.type === 'opaqueredirect' || res.status === 401 || res.status === 403
			? 'auth'
			: // 503 con el JSON de cloud/prefs.ts: la cuenta no está configurada (o D1 no responde). Se sigue en local.
				res.status === 503 && !memory
				? 'local'
				: 'error');

async function getRemote(): Promise<{ user: string; prefs: Prefs } | null> {
	const res = await fetch(url(), { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' });
	if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
		failed(res);
		return null;
	}
	const body = (await res.json()) as { user?: unknown; prefs?: unknown };
	return typeof body.user === 'string' && body.prefs && typeof body.prefs === 'object'
		? { user: body.user, prefs: body.prefs as Prefs }
		: null;
}

async function push(patch: Patch, keepalive = false): Promise<boolean> {
	if (isEmpty(patch)) return true;
	const body = JSON.stringify(patch);
	const res = await fetch(url(), {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body,
		credentials: 'same-origin',
		redirect: 'manual',
		// Al cerrar la pestaña, keepalive deja acabar el envío, pero el navegador no admite más de 64 KB así.
		keepalive: keepalive && body.length < 60_000
	});
	if (!res.ok) failed(res);
	return res.ok;
}

/** Lo que ha quedado aquí sin subir porque no cabe. */
const setFrozen = (keys: string[] | undefined) => {
	const next = keys ?? [];
	if (next.join() !== cloud.frozen.join()) cloud.frozen = next;
};

/** Otro usuario entra en este navegador: lo que el anterior guardó fuera de localStorage tampoco es suyo. */
function forgetPrevious() {
	for (const name of IDB) {
		try {
			indexedDB.deleteDatabase(name);
		} catch {}
	}
}

/**
 * ¿Ha desaparecido la memoria que esta pestaña tenía guardada? Otra pestaña ha cerrado la sesión o borrado la cuenta
 * (o se han borrado los datos de la web). Subir ahora lo de aquí, ya vacío, borraría la cuenta, y escribir la memoria
 * la resucitaría: esta pestaña deja de sincronizar hasta que se recargue.
 */
function vanished(): boolean {
	if (stopped) return true;
	try {
		if (!stored || localStorage.getItem(MEMORY) !== null) return false;
	} catch {
		return false;
	}
	stopped = true;
	memory = null;
	cloud.state = 'auth';
	return true;
}

/** Otra pestaña puede haber sincronizado: la memoria buena es la guardada, no la de esta pestaña. */
function refreshMemory() {
	if (vanished()) return;
	try {
		const saved = readMemory(localStorage.getItem(MEMORY));
		if (saved) stored = true;
		if (saved && (!memory || saved.user === memory.user)) memory = saved;
	} catch {}
}

function applyLocal(patch: Patch) {
	for (const [k, v] of Object.entries(patch.set)) localStorage.setItem(k, v);
	for (const k of patch.del) localStorage.removeItem(k);
}

function remember(user: string, base: Prefs) {
	memory = { user, base };
	localStorage.setItem(MEMORY, JSON.stringify(memory));
	stored = true;
}

/** Cambios de fuera que esperan a que dejes de escribir. */
let postponed = false;
let lastPull = 0;

/** Trae lo del servidor, junta y sube. Si ha cambiado algo de aquí, recarga para que las vistas lo lean. */
async function pull() {
	if (busy || stopped) return;
	busy = true;
	lastPull = Date.now();
	try {
		if (cloud.state !== 'ok') cloud.state = 'sync';
		const remote = await getRemote();
		if (!remote) return;
		refreshMemory();
		if (stopped) return;
		const local = collect(localStorage);
		const switching = !!memory && memory.user !== remote.user;
		const plan = startPlan(local, remote.prefs, memory, remote.user);
		// Escribiendo (una nota, la terminal…): cambiar los ajustes por debajo sin recargar dejaría la vista con lo
		// viejo, y su próximo guardado pisaría lo que llega de fuera. Se deja para cuando acabe.
		postponed = !isEmpty(plan.apply) && typing() && !switching;
		if (postponed) return;
		if (!(await push(plan.push)) || vanished()) return;
		if (switching) forgetPrevious();
		applyLocal(plan.apply);
		remember(remote.user, plan.result);
		cloud.user = remote.user;
		cloud.state = 'ok';
		setFrozen(plan.frozen);
		// Cada módulo lee sus ajustes al arrancar: una recarga (una sola por pestaña y vez) los pone al día.
		if (!isEmpty(plan.apply)) {
			if (sessionStorage.getItem(RELOADED) !== '1') {
				sessionStorage.setItem(RELOADED, '1');
				location.reload();
			}
		} else sessionStorage.removeItem(RELOADED);
	} catch {
		// Sin conexión: se intenta en la próxima. Todo sigue guardándose aquí.
		cloud.state = navigator.onLine === false ? 'offline' : 'error';
	} finally {
		busy = false;
	}
}

/** Sube lo que haya cambiado aquí desde la última vez. */
async function flush(keepalive = false) {
	if (busy || stopped || !memory) return;
	refreshMemory();
	if (!memory) return;
	const plan = mergeFitting(collect(localStorage), memory.base, memory.base);
	setFrozen(plan.frozen);
	if (isEmpty(plan.push)) return;
	busy = true;
	try {
		if ((await push(plan.push, keepalive)) && !vanished() && memory) {
			remember(memory.user, plan.result);
			cloud.state = 'ok';
		}
	} catch {
		// Igual que arriba: ya se subirá.
		cloud.state = navigator.onLine === false ? 'offline' : 'error';
	} finally {
		busy = false;
	}
}

const typing = () => {
	const el = document.activeElement as HTMLElement | null;
	return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

/** Se llama una vez desde +layout.svelte (como un onMounted). Devuelve la limpieza. */
export function initCloud() {
	// La API solo existe en la web publicada (Cloudflare), en la raíz. Si la ruta no cuadra, ni se intenta.
	if (new URL(url(), location.href).pathname !== '/api/prefs') return;
	try {
		memory = readMemory(localStorage.getItem(MEMORY));
		stored = !!memory;
	} catch {
		return;
	}
	cloud.state = 'sync';
	void pull();
	// Cada poco se sube lo de aquí. Si se dejó para luego, se vuelve a pedir lo de fuera al dejar de escribir; si
	// falló (sin conexión, error), como mucho una vez por minuto. Sin cuenta configurada (503) ni se insiste.
	const id = setInterval(() => {
		if (postponed && !typing()) void pull();
		else if (cloud.state === 'error' || cloud.state === 'offline') {
			if (Date.now() - lastPull > RETRY) void pull();
		} else if (memory) void flush();
	}, EVERY);
	const onOnline = () => void pull();
	addEventListener('online', onOnline);
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') void flush(true);
		else void pull();
	};
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		clearInterval(id);
		document.removeEventListener('visibilitychange', onVisibility);
		removeEventListener('online', onOnline);
	};
}

/**
 * Para «Cerrar sesión» y «Borrar mi cuenta» (signout.svelte.ts, solo en HELP). Espera a que acabe lo que se esté
 * subiendo o bajando (como mucho 5 s) y, con upload, sube lo que quede. Dice si queda aquí algo que no está en la
 * cuenta: cambios sin subir o claves que no caben (cloud.frozen).
 */
export async function settle(upload: boolean): Promise<boolean> {
	for (let i = 0; busy && i < 50; i++) await new Promise((r) => setTimeout(r, 100));
	if (upload) await flush();
	if (cloud.frozen.length) return true;
	return !!memory && !isEmpty(mergeFitting(collect(localStorage), memory.base, memory.base).push);
}

/** Esta pestaña deja de sincronizar (mientras se borra la cuenta, para no recrearla). Devuelve cómo volver. */
export function hold(): () => void {
	const was = stopped;
	stopped = true;
	return () => (stopped = was);
}

/**
 * Se sale de la cuenta: no se sincroniza más y se olvida la memoria. Va la primera, antes de borrar nada más: así las
 * demás pestañas abiertas paran antes de ver lo de aquí vacío (vanished).
 */
export function endSync() {
	stopped = true;
	memory = null;
	try {
		localStorage.removeItem(MEMORY);
	} catch {}
}
