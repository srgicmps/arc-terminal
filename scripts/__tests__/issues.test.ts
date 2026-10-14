import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SourceStatus, StatePoint } from '../../src/lib/data.ts';
import { body, decide, isDown, redact, sync, title } from '../issues.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

const point = (i: number, state: StatePoint['state']): StatePoint => ({
	t: `2026-10-14T1${i}:07Z`,
	state
});

function status(name: string, states: StatePoint['state'][], error?: string): SourceStatus {
	const history = states.map((s, i) => point(i, s));
	return { name, label: `Etiqueta ${name}`, state: states.at(-1) ?? 'ok', fetchedAt: null, error, history };
}

describe('isDown', () => {
	it('hacen falta 3 errores seguidos al final', () => {
		expect(isDown(status('a', ['error', 'error', 'error']))).toBe(true);
		expect(isDown(status('a', ['ok', 'error', 'error', 'error']))).toBe(true);
		expect(isDown(status('a', ['error', 'error']))).toBe(false);
		expect(isDown(status('a', ['error', 'error', 'stale']))).toBe(false);
		expect(isDown(status('a', ['error', 'ok', 'error', 'error']))).toBe(false);
	});

	it('sin historial no está caída', () => {
		expect(isDown({ name: 'a', label: '', state: 'error', fetchedAt: null })).toBe(false);
	});
});

describe('decide', () => {
	it('abre si está caída y no hay issue', () => {
		expect(decide(status('a', ['error', 'error', 'error']), undefined)).toEqual({ kind: 'open', name: 'a' });
	});

	it('actualiza si está caída y ya hay issue', () => {
		expect(decide(status('a', ['error', 'error', 'error']), 7)).toEqual({ kind: 'update', name: 'a', issue: 7 });
	});

	it('cierra solo cuando vuelve con ok o cached', () => {
		expect(decide(status('a', ['error', 'ok']), 7)).toEqual({ kind: 'close', name: 'a', issue: 7 });
		expect(decide(status('a', ['error', 'cached']), 7)).toEqual({ kind: 'close', name: 'a', issue: 7 });
		expect(decide(status('a', ['error', 'stale']), 7).kind).toBe('none');
		expect(decide(status('a', ['error', 'off']), 7).kind).toBe('none');
		expect(decide(status('a', ['error', 'error', 'error', 'ok', 'error']), 7).kind).toBe('none');
	});

	it('no hace nada con fuentes sanas o con pocos errores', () => {
		expect(decide(status('a', ['ok', 'ok', 'ok']), undefined).kind).toBe('none');
		expect(decide(status('a', ['ok', 'error', 'error']), undefined).kind).toBe('none');
		expect(decide(status('a', ['stale', 'stale', 'stale']), undefined).kind).toBe('none');
	});
});

describe('redact', () => {
	it('tapa las claves y quita la parte «?…» de las URL', () => {
		expect(redact('HTTP 500 en https://api.x.com/v1/obs?api_key=abcd1234&id=2 al leer', ['abcd1234'])).toBe(
			'HTTP 500 en https://api.x.com/v1/obs al leer'
		);
		expect(redact('token abcd1234 inválido', ['abcd1234', undefined, ''])).toBe('token *** inválido');
	});

	it('no toca mensajes sin secretos', () => {
		expect(redact('tiempo agotado (90 s)', [])).toBe('tiempo agotado (90 s)');
	});
});

describe('body', () => {
	it('lleva el último error saneado, desde cuándo y el enlace a STATUS', () => {
		const text = body(status('fred', ['ok', 'error', 'error', 'error'], 'HTTP 403 en https://f.org/s?api_key=SECRETO'), [
			'SECRETO'
		]);
		expect(text).toContain('**fred**');
		expect(text).toContain('3 pasadas seguidas');
		expect(text).toContain('Falla desde: 2026-10-14 11:07 UTC');
		expect(text).toContain('`HTTP 403 en https://f.org/s`');
		expect(text).toContain('https://srgicmps.github.io/arc-terminal/status');
		expect(text).not.toContain('SECRETO');
	});
});

describe('sync', () => {
	const REPO = 'srgicmps/arc-terminal';

	function github(open: { number: number; title: string; pull_request?: object }[]) {
		const calls: { method: string; path: string; body?: any }[] = [];
		const fn = mockFetch((url, init) => {
			const method = init?.method ?? 'GET';
			const path = url.replace('https://api.github.com', '');
			calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
			if (method === 'GET') return open;
			return { ok: true };
		});
		return { calls, fn };
	}

	it('busca los issues abiertos con la etiqueta y usa el token', async () => {
		const { calls, fn } = github([]);
		await sync([status('a', ['ok'])], { repo: REPO, token: 'tok' });
		expect(calls).toEqual([{ method: 'GET', path: `/repos/${REPO}/issues?state=open&labels=fuente-caida&per_page=100` }]);
		const headers = fn.mock.calls[0][1]?.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer tok');
	});

	it('abre un issue con título, etiqueta y cuerpo saneado', async () => {
		const { calls } = github([]);
		const done = await sync([status('boe', ['error', 'error', 'error'], 'fallo con clave K3Y!')], {
			repo: REPO,
			token: 'tok',
			secrets: ['K3Y!']
		});
		expect(done).toEqual([{ kind: 'open', name: 'boe' }]);
		expect(calls[1].method).toBe('POST');
		expect(calls[1].path).toBe(`/repos/${REPO}/issues`);
		expect(calls[1].body.title).toBe('Fuente caída: boe');
		expect(calls[1].body.labels).toEqual(['fuente-caida']);
		expect(calls[1].body.body).toContain('fallo con clave ***');
	});

	it('actualiza el issue abierto en vez de duplicarlo', async () => {
		const { calls } = github([{ number: 12, title: title('boe') }]);
		await sync([status('boe', ['error', 'error', 'error'])], { repo: REPO, token: 'tok' });
		expect(calls.slice(1).map((c) => `${c.method} ${c.path}`)).toEqual([`PATCH /repos/${REPO}/issues/12`]);
		expect(calls[1].body).toEqual({ body: expect.stringContaining('**boe**') });
	});

	it('comenta y cierra cuando la fuente vuelve', async () => {
		const { calls } = github([{ number: 12, title: title('boe') }]);
		await sync([status('boe', ['error', 'error', 'error', 'ok'])], { repo: REPO, token: 'tok' });
		expect(calls.slice(1).map((c) => `${c.method} ${c.path}`)).toEqual([
			`POST /repos/${REPO}/issues/12/comments`,
			`PATCH /repos/${REPO}/issues/12`
		]);
		expect(calls[2].body).toEqual({ state: 'closed', state_reason: 'completed' });
	});

	it('ignora PR y títulos que no coinciden exactamente', async () => {
		const { calls } = github([
			{ number: 1, title: title('boe'), pull_request: {} },
			{ number: 2, title: 'Fuente caída: boe (otra)' }
		]);
		await sync([status('boe', ['error', 'error', 'error'])], { repo: REPO, token: 'tok' });
		expect(calls[1].method).toBe('POST');
		expect(calls[1].path).toBe(`/repos/${REPO}/issues`);
	});

	it('falla si GitHub responde con error', async () => {
		mockFetch(() => undefined);
		await expect(sync([], { repo: REPO, token: 'tok' })).rejects.toThrow('HTTP 404');
	});
});
