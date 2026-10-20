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

/**
 * Una fuente que ha pasado por `states`, una pasada cada `step` (15 min si no se dice): su status, su historial
 * por tramos y `now`, la hora de la última pasada (cuando la Action corre issues.ts).
 */
function source(
	name: string,
	states: State[],
	error?: string,
	step = STEP
): { status: SourceStatus; history: SourceHistory; now: number } {
	let spans = appendSpan(undefined, states[0], START);
	states.slice(1).forEach((s, i) => (spans = appendSpan(spans, s, START + (i + 1) * step)));
	return {
		status: { name, label: `Etiqueta ${name}`, state: states.at(-1)!, fetchedAt: null, error },
		history: { name, lastRun: '', history: spans },
		now: START + (states.length - 1) * step
	};
}

const check = (states: State[], issue?: number) => {
	const { status, history, now } = source('a', states);
	return decide(status, history, issue, now);
};

/** ¿Caída en la última pasada? */
const down = (states: State[], step = STEP) => {
	const { history, now } = source('a', states, undefined, step);
	return downSpan(history, now);
};

describe('downSpan', () => {
	it('el tramo actual tiene que ser «error» desde hace 45 min o más', () => {
		// Pasadas a los 0, 15, 30 y 45 min: 45 min en error.
		expect(down(['error', 'error', 'error', 'error'])?.runs).toBe(4);
		expect(down(['ok', 'error', 'error', 'error', 'error'])?.t).toBe('2026-10-14T10:22Z');
		expect(down(['error', 'error', 'error'])).toBeNull();
		expect(down(['error', 'error', 'error', 'stale'])).toBeNull();
		expect(down(['error', 'ok', 'error', 'error', 'error'])).toBeNull();
	});

	it('cuenta el tiempo, no las pasadas: con una cada 5 min, 9 en error (40 min) no basta y 10 (45 min) sí', () => {
		const errors = (n: number) => Array<State>(n).fill('error');
		expect(down(errors(3), 5 * 60_000)).toBeNull();
		expect(down(errors(9), 5 * 60_000)).toBeNull();
		expect(down(errors(10), 5 * 60_000)?.runs).toBe(10);
	});

	it('con pocas pasadas muy separadas (GitHub se saltó las de en medio), basta con el tiempo', () => {
		expect(down(['error', 'error'], 60 * 60_000)?.runs).toBe(2);
		// Una sola pasada en error: el tramo acaba de empezar.
		expect(down(['error'])).toBeNull();
	});

	it('el umbral y la hora se pueden pasar', () => {
		const { history, now } = source('a', ['error', 'error']);
		expect(downSpan(history, now, 15)?.runs).toBe(2);
		expect(downSpan(history, now + 30 * 60_000)?.runs).toBe(2);
	});

	it('sin historial, o con una fecha que no se entiende, no está caída', () => {
		expect(downSpan(undefined)).toBeNull();
		expect(downSpan({ name: 'a', lastRun: '', history: [] })).toBeNull();
		expect(downSpan({ name: 'a', lastRun: '', history: [{ t: '—', state: 'error', runs: 9 }] })).toBeNull();
	});
});

describe('decide', () => {
	it('abre si está caída y no hay issue', () => {
		expect(check(['error', 'error', 'error', 'error'])).toEqual({ kind: 'open', name: 'a' });
	});

	it('actualiza si está caída y ya hay issue', () => {
		expect(check(['error', 'error', 'error', 'error'], 7)).toEqual({ kind: 'update', name: 'a', issue: 7 });
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
		expect(check(['error', 'error', 'error']).kind).toBe('none');
		expect(check(['stale', 'stale', 'stale']).kind).toBe('none');
	});

	it('si el status y el historial no cuadran, manda el status de ahora', () => {
		const { history, now } = source('a', ['error', 'error', 'error', 'error']);
		const status: SourceStatus = { name: 'a', label: '', state: 'ok', fetchedAt: null };
		expect(decide(status, history, 7, now).kind).toBe('close');
		expect(decide(status, history, undefined, now).kind).toBe('none');
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
		expect(text).toContain('https://arcterminal.dev/status');
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
		const boe = source('boe', ['error', 'error', 'error', 'error'], 'fallo con clave K3Y!');
		const done = await sync([boe.status], [boe.history], {
			repo: REPO,
			token: 'tok',
			secrets: ['K3Y!'],
			now: boe.now
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
		const boe = source('boe', ['error', 'error', 'error', 'error']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok', now: boe.now });
		expect(calls.slice(1).map((c) => `${c.method} ${c.path}`)).toEqual([`PATCH /repos/${REPO}/issues/12`]);
		expect(calls[1].body).toEqual({ body: expect.stringContaining('**boe**') });
	});

	it('comenta y cierra cuando la fuente vuelve', async () => {
		const { calls } = github([{ number: 12, title: title('boe') }]);
		const boe = source('boe', ['error', 'error', 'error', 'ok']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok', now: boe.now });
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
		const boe = source('boe', ['error', 'error', 'error', 'error']);
		await sync([boe.status], [boe.history], { repo: REPO, token: 'tok', now: boe.now });
		expect(calls[1].method).toBe('POST');
		expect(calls[1].path).toBe(`/repos/${REPO}/issues`);
	});

	it('empareja cada fuente con su historial por nombre; sin historial no abre nada', async () => {
		const { calls } = github([]);
		const boe = source('boe', ['error', 'error', 'error', 'error']);
		const fuel = source('fuel', ['error', 'error', 'error', 'error']);
		const done = await sync([boe.status, fuel.status], [fuel.history], { repo: REPO, token: 'tok', now: fuel.now });
		expect(done).toEqual([{ kind: 'open', name: 'fuel' }]);
		expect(calls[1].body.title).toBe('Fuente caída: fuel');
	});

	it('con 30 min en error todavía no abre nada', async () => {
		const { calls } = github([]);
		const boe = source('boe', ['error', 'error', 'error']);
		const done = await sync([boe.status], [boe.history], { repo: REPO, token: 'tok', now: boe.now });
		expect(done).toEqual([]);
		expect(calls).toHaveLength(1);
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
