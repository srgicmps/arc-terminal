// Ajustes en tu cuenta, en el navegador (la lógica, en cloud.ts; el servidor, en cloud/prefs.ts).
// localStorage sigue siendo donde lee y escribe cada módulo, como siempre: esto solo lo copia al servidor y
// trae lo de tus otros dispositivos. Sin servidor (GitHub Pages, sin conexión, en local), no hace nada.
import { asset } from '$app/paths';
import { collect } from './transfer.ts';
import { PREFS } from './prefs.ts';
import { LOGOUT } from './account.ts';
import {
	HOLD,
	holdActive,
	isEmpty,
	MEMORY,
	mergeFitting,
	NOBODY,
	readMemory,
	replaced,
	startPlan,
	type Patch,
	type Prefs,
	type SyncMemory
} from './cloud.ts';

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
/** Esta pestaña se ha quedado con la cuenta anterior (otra ha entrado con otra): no sincroniza más y se recarga. */
let stale = false;
/** «Borrar mi cuenta» en marcha en esta pestaña (hold): no sube ni baja nada, que lo recrearía. */
let held = false;

/** La pausa, para las demás pestañas: la hora de ahora en HOLD (cloud.ts). La pestaña que borra la renueva cada 5 s. */
function markHold() {
	try {
		localStorage.setItem(HOLD, String(Date.now()));
	} catch {}
}

/** ¿Quieto? Esta pestaña está borrando la cuenta (held) u otra lo está (HOLD de hace menos de 30 s). */
function paused(): boolean {
	if (held) return true;
	try {
		return holdActive(localStorage.getItem(HOLD), Date.now());
	} catch {
		return false;
	}
}

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

/** Lo que enseña esta pestaña y lo que tiene en memoria es de la cuenta anterior: se recarga (una vez) con la nueva. */
function reloadStale() {
	if (stale) return;
	stale = true;
	location.reload();
}

/**
 * Otra pestaña puede haber sincronizado: la memoria buena es la guardada, no la de esta pestaña. Si la guardada es de
 * otra cuenta (tras «Cerrar sesión» ha entrado otra persona), esta pestaña se recarga y no sube ni baja nada: false.
 */
function refreshMemory(): boolean {
	try {
		const saved = readMemory(localStorage.getItem(MEMORY));
		if (replaced(memory, saved)) reloadStale();
		else if (saved) memory = saved;
	} catch {}
	return !stale;
}

function applyLocal(patch: Patch) {
	for (const [k, v] of Object.entries(patch.set)) localStorage.setItem(k, v);
	for (const k of patch.del) localStorage.removeItem(k);
}

function remember(user: string, base: Prefs) {
	const next = { user, base };
	// Primero se guarda: si no cabe, la pestaña sigue con la memoria de antes, igual que las demás (refreshMemory).
	localStorage.setItem(MEMORY, JSON.stringify(next));
	memory = next;
}

/** Cambios de fuera que esperan a que dejes de escribir. */
let postponed = false;
let lastPull = 0;

/** Trae lo del servidor, junta y sube. Si ha cambiado algo de aquí, recarga para que las vistas lo lean. */
async function pull() {
	if (busy || stale || paused()) return;
	busy = true;
	lastPull = Date.now();
	try {
		if (cloud.state !== 'ok') cloud.state = 'sync';
		const remote = await getRemote();
		// Mientras llegaba la respuesta, otra pestaña puede haber empezado a borrar la cuenta: no se sube nada.
		if (!remote || !refreshMemory() || paused()) return;
		const local = collect(localStorage);
		const switching = !!memory && memory.user !== remote.user;
		const plan = startPlan(local, remote.prefs, memory, remote.user);
		// Escribiendo (una nota, la terminal…): cambiar los ajustes por debajo sin recargar dejaría la vista con lo
		// viejo, y su próximo guardado pisaría lo que llega de fuera. Se deja para cuando acabe.
		postponed = !isEmpty(plan.apply) && typing() && !switching;
		if (postponed) return;
		if (!(await push(plan.push))) return;
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

/**
 * Sube lo que haya cambiado aquí desde la última vez. Con la sesión cerrada o caducada (auth) no: la próxima cookie
 * puede ser de otra persona, y esto iría a su cuenta. Lo de aquí sigue guardado y sube en el próximo pull, que mira
 * antes de quién es la cuenta (startPlan). Tampoco sin una cuenta confirmada por un pull en esta pestaña (cloud.user):
 * con la memoria de nadie (NOBODY, tras «Borrar mi cuenta») subiría todo lo de aquí a quien entrase.
 */
async function flush(keepalive = false) {
	if (busy || stale || paused() || !memory?.user || memory.user !== cloud.user || cloud.state === 'auth') return;
	if (!refreshMemory()) return;
	const plan = mergeFitting(collect(localStorage), memory.base, memory.base);
	setFrozen(plan.frozen);
	if (isEmpty(plan.push)) return;
	busy = true;
	try {
		if (await push(plan.push, keepalive)) {
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
	} catch {
		return;
	}
	cloud.state = 'sync';
	void pull();
	// Cada poco se sube lo de aquí. Si se dejó para luego, se vuelve a pedir lo de fuera al dejar de escribir; si
	// falló (sin conexión, error), como mucho una vez por minuto. Sin cuenta configurada (503) ni se insiste.
	const id = setInterval(() => {
		// Borrando la cuenta aquí: se renueva la pausa de las demás pestañas (también con la duda, unsure).
		if (held) markHold();
		else if (postponed && !typing()) void pull();
		else if (cloud.state === 'error' || cloud.state === 'offline') {
			if (Date.now() - lastPull > RETRY) void pull();
		} else if (memory) void flush();
	}, EVERY);
	const onOnline = () => void pull();
	addEventListener('online', onOnline);
	// Otra pestaña ha entrado con otra cuenta: esta enseña lo de la anterior y no puede seguir así ni un momento. Si
	// la otra ha borrado la cuenta (memoria de nadie), esta sale también, sin recargar: recargar antes de que se cierre
	// la sesión volvería a pedir /api/prefs con la cuenta borrada.
	const onStorage = (e: StorageEvent) => {
		if (e.key !== MEMORY) return;
		const saved = readMemory(e.newValue);
		if (memory && saved?.user === NOBODY.user) {
			stale = true;
			location.assign(LOGOUT);
		} else if (replaced(memory, saved)) reloadStale();
	};
	addEventListener('storage', onStorage);
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') void flush(true);
		else void pull();
	};
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		clearInterval(id);
		document.removeEventListener('visibilitychange', onVisibility);
		removeEventListener('online', onOnline);
		removeEventListener('storage', onStorage);
	};
}

/**
 * «Cerrar sesión» (HELP): sube ya lo que quede. La respuesta de la salida de Access borra la cookie antes de que se
 * cierre esta página, así que el flush de visibilitychange llegaría sin sesión. keepalive deja acabar el envío.
 */
export const flushNow = () => void flush(true);

/**
 * «Borrar mi cuenta» (account.svelte.ts, solo en HELP): ninguna pestaña de este navegador sincroniza (subir ahora
 * recrearía la cuenta): esta, por held; las demás, por la marca HOLD. Espera a que acabe lo que esta tuviera en
 * marcha, como mucho 5 s. Devuelve cómo seguir si al final no se borra (quita la marca), o null si sigue en marcha
 * (entonces no se puede borrar todavía). Si se borra, la marca se queda hasta endSync.
 */
export async function hold(): Promise<(() => void) | null> {
	held = true;
	markHold();
	for (let i = 0; busy && i < 50; i++) await new Promise((r) => setTimeout(r, 100));
	const resume = () => {
		held = false;
		try {
			localStorage.removeItem(HOLD);
		} catch {}
	};
	if (!busy) return resume;
	resume();
	return null;
}

/**
 * Tras «Borrar mi cuenta»: la memoria pasa a ser de nadie (NOBODY en cloud.ts) y esta pestaña no sincroniza más. Va
 * lo primero, antes de borrar nada: las demás pestañas lo ven (storage) y salen antes de poder subir lo de aquí. Con
 * la memoria de nadie ya no hace falta la pausa (HOLD): se quita después, nunca antes.
 */
export function endSync() {
	stale = true;
	memory = null;
	try {
		localStorage.setItem(MEMORY, JSON.stringify(NOBODY));
		localStorage.removeItem(HOLD);
	} catch {}
}
