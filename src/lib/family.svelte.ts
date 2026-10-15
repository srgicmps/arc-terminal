// «Mandar a la familia» (F15) en el navegador: a quién puedes mandar un titular y tu ajuste. Se pide una vez
// por visita a /api/family (cloud/family.ts) y solo en arcterminal.dev, donde hay cuenta; en local, nada.
import { asset } from '$app/paths';

export interface Person {
	id: string;
	name: string;
}

const url = () => asset('api/family' as Parameters<typeof asset>[0]);

export const family = $state({
	phase: 'idle' as 'idle' | 'loading' | 'none' | 'ready' | 'error',
	me: { name: '', accept: false },
	reachable: false,
	people: [] as Person[]
});

async function fetchJson(method = 'GET', body?: unknown) {
	const res = await fetch(url(), {
		method,
		cache: 'no-store',
		redirect: 'manual',
		headers: body ? { 'content-type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined
	});
	if (!res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
	return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Carga la lista una vez (o de nuevo con `force`). */
export async function loadFamily(force = false) {
	if (family.phase === 'loading' || (!force && family.phase !== 'idle')) return;
	if (new URL(url(), location.href).pathname !== '/api/family') {
		family.phase = 'none';
		return;
	}
	family.phase = 'loading';
	try {
		const { status, body } = await fetchJson();
		if (status !== 200) throw new Error(String(status));
		family.me = body.me as typeof family.me;
		family.reachable = body.reachable === true;
		family.people = body.people as Person[];
		family.phase = 'ready';
	} catch {
		family.phase = 'error';
	}
}

/** Guarda tu nombre y si aceptas recibir. true si ha ido bien. */
export async function saveFamily(name: string, accept: boolean): Promise<boolean> {
	try {
		const { status } = await fetchJson('PUT', { name, accept });
		if (status !== 200) return false;
		await loadFamily(true);
		return true;
	} catch {
		return false;
	}
}

/** Manda un titular a una persona. Devuelve un texto corto para enseñar. */
export async function sendFamily(to: Person, title: string, link: string): Promise<string> {
	try {
		const { status } = await fetchJson('POST', { to: to.id, title, url: link });
		if (status === 200) return `Enviado a ${to.name}`;
		if (status === 409) return 'Pon antes tu nombre en AVISOS';
		if (status === 429) return 'Tope de hoy alcanzado';
		return 'No se ha podido mandar';
	} catch {
		return 'No se ha podido mandar';
	}
}
