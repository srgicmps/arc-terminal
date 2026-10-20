// «Borrar mi cuenta» y la pausa de la sincronización, con los módulos del navegador de verdad (cloud.svelte.ts y
// account.svelte.ts) sobre un navegador de mentira: localStorage, sessionStorage, eventos, reloj y fetch. Los tests no
// pasan por el compilador de Svelte: $state va de mentira (devuelve el objeto tal cual), igual que $app/paths.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEPT, LOGOUT } from './account.ts';
import { HOLD, HOLD_MS, MEMORY, NOBODY } from './cloud.ts';

vi.mock('$app/paths', () => ({ asset: (p: string) => `/${p}` }));

const ANA = 'ana@x.es';

class FakeStorage {
	private m = new Map<string, string>();
	get length() {
		return this.m.size;
	}
	key(i: number) {
		return [...this.m.keys()][i] ?? null;
	}
	getItem(k: string) {
		return this.m.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.m.set(k, String(v));
	}
	removeItem(k: string) {
		this.m.delete(k);
	}
	clear() {
		this.m.clear();
	}
}

/** Lo justo de una Response para cloud.svelte.ts y account.svelte.ts. */
const reply = (status: number, body: unknown = {}) =>
	({
		ok: status >= 200 && status < 300,
		status,
		type: 'basic',
		headers: { get: () => 'application/json' },
		json: async () => body
	}) as unknown as Response;

let local: FakeStorage;
let session: FakeStorage;
let win: EventTarget;
let doc: EventTarget & { visibilityState: string; activeElement: null };
let assign: ReturnType<typeof vi.fn>;
/** Lo que se ha pedido a /api: «GET /api/prefs», «PUT /api/prefs», «DELETE /api/account». */
let requests: string[];
/** La respuesta a cada petición (por defecto, la cuenta de Ana vacía). */
let answer: (method: string, url: string) => Response | Promise<Response>;
let stop: (() => void) | undefined;

beforeEach(() => {
	vi.useFakeTimers({
		now: 1_800_000_000_000,
		toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
	});
	vi.resetModules();
	local = new FakeStorage();
	session = new FakeStorage();
	win = new EventTarget();
	doc = Object.assign(new EventTarget(), { visibilityState: 'visible', activeElement: null });
	assign = vi.fn();
	requests = [];
	answer = (method) => reply(200, method === 'GET' ? { user: ANA, prefs: {} } : { ok: true });
	vi.stubGlobal('$state', <T>(v: T) => v);
	vi.stubGlobal('localStorage', local);
	vi.stubGlobal('sessionStorage', session);
	vi.stubGlobal('document', doc);
	vi.stubGlobal('navigator', { onLine: true });
	vi.stubGlobal('location', { href: 'https://arcterminal.dev/help', reload: vi.fn(), assign });
	vi.stubGlobal('addEventListener', win.addEventListener.bind(win));
	vi.stubGlobal('removeEventListener', win.removeEventListener.bind(win));
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			const method = init?.method ?? 'GET';
			requests.push(`${method} ${url}`);
			return answer(method, url);
		})
	);
});

afterEach(() => {
	stop?.();
	stop = undefined;
	vi.useRealTimers();
});

/** Deja acabar lo que esté a medias (promesas), sin mover el reloj. */
const settle = async () => {
	for (let i = 0; i < 50; i++) await Promise.resolve();
};

/** Arranca la sincronización de esta pestaña, con la cuenta de Ana ya conocida (memoria) y lo que haya aquí. */
async function boot() {
	local.setItem(MEMORY, JSON.stringify({ user: ANA, base: {} }));
	const sync = await import('./cloud.svelte.ts');
	stop = sync.initCloud();
	await settle();
	return sync;
}

describe('la pausa de «Borrar mi cuenta» en las demás pestañas (cloud.svelte.ts)', () => {
	it('una pestaña que arranca (o recarga) con la pausa puesta sincroniza en cuanto caduca', async () => {
		local.setItem(HOLD, String(Date.now()));
		local.setItem('arc-mortgage', '{"capital":150000}');
		const { cloud } = await boot();
		await vi.advanceTimersByTimeAsync(HOLD_MS - 5000);
		await settle();
		expect(requests).toEqual([]);
		expect(cloud.user).toBe('');
		// La marca ya no vale (la pestaña que borraba se cerró): trae lo de la cuenta y sube lo de aquí.
		await vi.advanceTimersByTimeAsync(5000);
		await settle();
		expect(requests).toEqual(['GET /api/prefs', 'PUT /api/prefs']);
		expect(cloud.user).toBe(ANA);
		expect(cloud.state).toBe('ok');
	});

	it('si la otra pestaña quita la pausa (no se ha borrado), esta sincroniza en la siguiente vuelta', async () => {
		local.setItem(HOLD, String(Date.now()));
		const { cloud } = await boot();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(requests).toEqual([]);
		local.removeItem(HOLD);
		await vi.advanceTimersByTimeAsync(5000);
		await settle();
		expect(requests).toEqual(['GET /api/prefs']);
		expect(cloud.user).toBe(ANA);
	});

	it('sin cuenta configurada (503), tras la pausa pide una vez y no insiste', async () => {
		answer = () => reply(503, { error: 'sin configurar' });
		local.setItem(HOLD, String(Date.now()));
		const sync = await import('./cloud.svelte.ts');
		stop = sync.initCloud();
		await vi.advanceTimersByTimeAsync(HOLD_MS + 120_000);
		await settle();
		expect(requests).toEqual(['GET /api/prefs']);
		expect(sync.cloud.state).toBe('local');
	});
});

describe('la pestaña que borra (cloud.svelte.ts)', () => {
	it('tras endSync, la pausa no vuelve aunque la salida de Access tarde', async () => {
		const sync = await boot();
		expect(sync.cloud.user).toBe(ANA);
		expect(await sync.hold()).not.toBeNull();
		await vi.advanceTimersByTimeAsync(5000);
		expect(local.getItem(HOLD)).not.toBeNull();
		sync.endSync();
		expect(local.getItem(HOLD)).toBeNull();
		await vi.advanceTimersByTimeAsync(15_000);
		expect(local.getItem(HOLD)).toBeNull();
		expect(local.getItem(MEMORY)).toBe(JSON.stringify(NOBODY));
	});
});

describe('deleteAccount (account.svelte.ts)', () => {
	it('primer intento sin respuesta y reintento con error: sigue la duda y no dice «No se ha borrado nada»', async () => {
		await boot();
		const { account, deleteAccount } = await import('./account.svelte.ts');
		let tries = 0;
		answer = (method) => {
			if (method !== 'DELETE') return reply(200, { user: ANA, prefs: {} });
			if (tries++ === 0) throw new TypeError('Failed to fetch');
			return reply(503, { error: 'no disponible' });
		};
		const pending = deleteAccount();
		await settle();
		await vi.advanceTimersByTimeAsync(2000);
		const msg = await pending;
		expect(requests).toEqual(['GET /api/prefs', 'DELETE /api/account', 'DELETE /api/account']);
		expect(msg).not.toContain(KEPT);
		expect(msg).toMatch(/No se ha podido comprobar si se ha borrado/);
		expect(account.unsure).toBe(true);
		// La pausa sigue (y se renueva) en todas las pestañas: nada sube a la cuenta que quizá ya no existe.
		await vi.advanceTimersByTimeAsync(HOLD_MS * 2);
		expect(Number(local.getItem(HOLD))).toBeGreaterThan(Date.now() - HOLD_MS);
		expect(requests.filter((r) => r.endsWith('/api/prefs'))).toEqual(['GET /api/prefs']);
	});
});
