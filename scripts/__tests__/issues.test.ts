import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SourceHistory, SourceStatus } from '../../src/lib/data.ts';
import { appendSpan } from '../history.ts';
import { body, decide, downSpan, madridTime, redact, sync, title } from '../issues.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

type State = SourceStatus['state'];
const START = Date.parse('2026-10-14T10:07:00Z');
const STEP = 15 * 60_000;

/** Una fuente que ha pasado por `states`, una pasada cada 15 min: su status y su historial por tramos. */
function source(name: string, states: State[], error?: string): { status: SourceStatus; history: SourceHistory } {
	let spans = appendSpan(undefined, states[0], START);
	states.slice(1).forEach((s, i) => (spans = appendSpan(spans, s, START + (i + 1) * STEP)));
	return {
		status: { name, label: `Etiqueta ${name}`, state: states.at(-1)!, fetchedAt: null, error },
		history: { name, lastRun: '', history: spans }
	};
}

const check = (states: State[], issue?: number) => {
	const { status, history } = source('a', states);
	return decide(status, history, issue);
};

describe('downSpan', () => {
	it('el tramo actual tiene que ser «error» con 3 pasadas o más', () => {
		expect(downSpan(source('a', ['error', 'error', 'error']).history)?.runs).toBe(3);
		expect(downSpan(source('a', ['ok', 'error', 'error', 'error', 'error']).history)?.runs).toBe(4);
		expect(downSpan(source('a', ['error', 'error']).history)).toBeNull();
		expect(downSpan(source('a', ['error', 'error', 'stale']).history)).toBeNull();
		expect(downSpan(source('a', ['error', 'ok', 'error', 'error']).history)).toBeNull();
	});

	it('sin historial no está caída', () => {
		expect(downSpan(undefined)).toBeNull();
		expect(downSpan({ name: 'a', lastRun: '', history: [] })).toBeNull();
	});
});

describe('decide', () => {
	it('abre si está caída y no hay issue', () => {
		expect(check(['error', 'error', 'error'])).toEqual({ kind: 'open', name: 'a' });
	});

	it('actualiza si está caída y ya hay issue', () => {
		expect(check(['error', 'error', 'error'], 7)).toEqual({ kind: 'update', name: 'a', issue: 7 });
	});

	it('cierra solo cuando vuelve con ok o cached', () => {
		expect(check(['error', 'error', 'error', 'ok'], 7)).toEqual({ kind: 'close', name: 'a', issue: 7 });
		expect(check(['error', 'cached'], 7)).toEqual({ kind: 'close', name: 'a', issue: 7 });
		expect(check(['error', 'stale'], 7).kind).toBe('none');
		expect(check(['error', 'off'], 7).kind).toBe('none');
		expect(check(['error', 'error', 'error', 'ok', 'error'], 7).kind).toBe('none');
	});

	it('no hace nada con fuentes sanas o con pocos errores', () => {
		expect(check(['ok', 'ok', 'ok']).kind).toBe('none');
		expect(check(['ok', 'error', 'error']).kind).toBe('none');
		expect(check(['stale', 'stale', 'stale']).kind).toBe('none');
	});

	it('si el status y el historial no cuadran, manda el status de ahora', () => {
		const { history } = source('a', ['error', 'error', 'error']);
		const status: SourceStatus = { name: 'a', label: '', state: 'ok', fetchedAt: null };
		expect(decide(status, history, 7).kind).toBe('close');
		expect(decide(status, history, undefined).kind).toBe('none');
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
		const { status, history } = source('fred', ['ok', 'error', 'error', 'error'], 'HTTP 403 en https://f.org/s?api_key=SECRETO');
		const text = body(status, history, ['SECRETO']);
		expect(text).toContain('**fred**');
		expect(text).toContain('3 pasadas seguidas');
		expect(text).toContain('Falla desde: 14 oct 2026, 12:22 (hora de Madrid)');
		expect(text).not.toContain('UTC');
		expect(text).toContain('`HTTP 403 en https://f.org/s`');
		expect(text).toContain('https://arc-terminal.pages.dev/status');
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
		await sync([source('a', ['ok']).status], [], { repo: REPO, token: 'tok' });
		expect(calls).toEqual([{ method: 'GET', path: `/repos/${REPO}/issues?state=open&labels=fuente-caida&per_page=100` }]);
		const headers = fn.mock.calls[0][1]?.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer tok');
	});

	it('abre un issue con título, etiqueta y cuerpo saneado', async () => {
		const { calls } = github([]);
		const boe = source('boe', ['error', 'error', 'error'], 'fallo con clave K3Y!');
		const done = await sync([boe.status], [boe.history], {
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
		const boe = source('boe', ['error', 'error', 'error']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok' });
		expect(calls.slice(1).map((c) => `${c.method} ${c.path}`)).toEqual([`PATCH /repos/${REPO}/issues/12`]);
		expect(calls[1].body).toEqual({ body: expect.stringContaining('**boe**') });
	});

	it('comenta y cierra cuando la fuente vuelve', async () => {
		const { calls } = github([{ number: 12, title: title('boe') }]);
		const boe = source('boe', ['error', 'error', 'error', 'ok']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok' });
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
		const boe = source('boe', ['error', 'error', 'error']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok' });
		expect(calls[1].method).toBe('POST');
		expect(calls[1].path).toBe(`/repos/${REPO}/issues`);
	});

	it('empareja cada fuente con su historial por nombre; sin historial no abre nada', async () => {
		const { calls } = github([]);
		const boe = source('boe', ['error', 'error', 'error']);
		const fuel = source('fuel', ['error', 'error', 'error']);
		const done = await sync([boe.status, fuel.status], [fuel.history], { repo: REPO, token: 'tok' });
		expect(done).toEqual([{ kind: 'open', name: 'fuel' }]);
		expect(calls[1].body.title).toBe('Fuente caída: fuel');
	});

	it('falla si GitHub responde con error', async () => {
		mockFetch(() => undefined);
		await expect(sync([], [], { repo: REPO, token: 'tok' })).rejects.toThrow('HTTP 404');
	});
});

describe('madridTime', () => {
	it('pasa la hora a Madrid en verano (UTC+2) y en invierno (UTC+1)', () => {
		expect(madridTime('2026-10-14T10:22:00Z')).toBe('14 oct 2026, 12:22 (hora de Madrid)');
		expect(madridTime('2026-10-25T02:30:00Z')).toBe('25 oct 2026, 03:30 (hora de Madrid)');
		expect(madridTime('2026-12-31T23:30:00Z')).toBe('1 ene 2027, 00:30 (hora de Madrid)');
	});

	it('deja tal cual una fecha que no se entiende', () => {
		expect(madridTime('—')).toBe('—');
	});
});
