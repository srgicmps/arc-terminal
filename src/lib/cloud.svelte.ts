// Ajustes en tu cuenta, en el navegador (la lógica, en cloud.ts; el servidor, en cloud/prefs.ts).
// localStorage sigue siendo donde lee y escribe cada módulo, como siempre: esto solo lo copia al servidor y
// trae lo de tus otros dispositivos. Sin servidor (GitHub Pages, sin conexión, en local), no hace nada.
import { asset } from '$app/paths';
import { collect } from './transfer.ts';
import { isEmpty, merge, readMemory, startPlan, type Patch, type Prefs, type SyncMemory } from './cloud.ts';

const MEMORY = 'arc-sync';
const RELOADED = 'arc-sync-reload';
const EVERY = 5000;

/** Para HELP: con qué cuenta se guardan tus ajustes ('' si no hay servidor). */
export const cloud = $state({ user: '' });

let memory: SyncMemory | null = null;
let busy = false;

const url = () => asset('api/prefs' as Parameters<typeof asset>[0]);

async function getRemote(): Promise<{ user: string; prefs: Prefs } | null> {
	const res = await fetch(url(), { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' });
	if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
	const body = (await res.json()) as { user?: unknown; prefs?: unknown };
	return typeof body.user === 'string' && body.prefs && typeof body.prefs === 'object'
		? { user: body.user, prefs: body.prefs as Prefs }
		: null;
}

async function push(patch: Patch, keepalive = false): Promise<boolean> {
	if (isEmpty(patch)) return true;
	const res = await fetch(url(), {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(patch),
		credentials: 'same-origin',
		redirect: 'manual',
		keepalive
	});
	return res.ok;
}

function applyLocal(patch: Patch) {
	for (const [k, v] of Object.entries(patch.set)) localStorage.setItem(k, v);
	for (const k of patch.del) localStorage.removeItem(k);
}

function remember(user: string, base: Prefs) {
	memory = { user, base };
	localStorage.setItem(MEMORY, JSON.stringify(memory));
}

/** Trae lo del servidor, junta y sube. Si ha cambiado algo de aquí, recarga para que las vistas lo lean. */
async function pull(first: boolean) {
	if (busy) return;
	busy = true;
	try {
		const remote = await getRemote();
		if (!remote) return;
		const local = collect(localStorage);
		const plan = first
			? startPlan(local, remote.prefs, memory, remote.user)
			: merge(local, remote.prefs, memory?.base ?? null);
		if (!(await push(plan.push))) return;
		applyLocal(plan.apply);
		remember(remote.user, plan.result);
		cloud.user = remote.user;
		// Cada módulo lee sus ajustes al arrancar: una recarga (una sola por pestaña y vez) los pone al día.
		if (!isEmpty(plan.apply) && !typing()) {
			if (sessionStorage.getItem(RELOADED) !== '1') {
				sessionStorage.setItem(RELOADED, '1');
				location.reload();
			}
		} else sessionStorage.removeItem(RELOADED);
	} catch {
		// Sin conexión o con la sesión de Access caducada: se intenta en la próxima.
	} finally {
		busy = false;
	}
}

/** Sube lo que haya cambiado aquí desde la última vez. */
async function flush(keepalive = false) {
	if (busy || !memory) return;
	const plan = merge(collect(localStorage), memory.base, memory.base);
	if (isEmpty(plan.push)) return;
	busy = true;
	try {
		if (await push(plan.push, keepalive)) remember(memory.user, plan.result);
	} catch {
		// Igual que arriba: ya se subirá.
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
	void pull(true);
	const id = setInterval(() => void flush(), EVERY);
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') void flush(true);
		else void pull(false);
	};
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		clearInterval(id);
		document.removeEventListener('visibilitychange', onVisibility);
	};
}
