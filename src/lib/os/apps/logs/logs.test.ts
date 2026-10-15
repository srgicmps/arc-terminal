import { describe, expect, it } from 'vitest';
import type { SourceStatus } from '../../../data.ts';
import { filterLines, fromHistory, fromNotices, fromNotifyLog, fromSession, fromStatus, linesCsv, origins, rangeStart, sortLines, summarize, type Filter } from './logs.ts';

const now = new Date(2026, 9, 15, 12, 0).getTime();
const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const s = (name: string, state: SourceStatus['state'], minAgo: number | null, extra: Partial<SourceStatus> = {}): SourceStatus => ({
	name,
	label: name.toUpperCase(),
	state,
	fetchedAt: minAgo === null ? null : iso(minAgo),
	maxAgeMinutes: 30,
	...extra
});
const base: Filter = { levels: [], kinds: [], origin: '', words: [], range: 'todo', now };

describe('Centro de registros', () => {
	it('una línea por fuente, con nivel según el estado y «caducada» si va con retraso', () => {
		const lines = fromStatus(
			[s('a', 'ok', 5), s('b', 'error', null, { error: 'HTTP 500' }), s('c', 'stale', 20), s('d', 'cached', 200), s('e', 'off', null, { requires: 'FRED_API_KEY' })],
			now
		);
		expect(lines.map((l) => l.level)).toEqual(['info', 'error', 'aviso', 'aviso', 'info']);
		expect(lines[1].msg).toContain('HTTP 500');
		expect(lines[3].msg).toMatch(/^Caducada/);
		expect(lines[4].msg).toContain('FRED_API_KEY');
		expect(lines[0].origin).toBe('A');
	});

	it('del historial apunta fallos y recuperaciones, no los tramos buenos sueltos', () => {
		const lines = fromHistory(
			[
				{ name: 'a', lastRun: iso(0), history: [{ t: iso(600), state: 'ok', runs: 10 }, { t: iso(300), state: 'error', runs: 2 }, { t: iso(200), state: 'ok', runs: 5 }] },
				{ name: 'b', lastRun: iso(0), history: [{ t: iso(100), state: 'cached', runs: 3 }] }
			],
			{ a: 'Fuente A' }
		);
		expect(lines.map((l) => [l.level, l.origin])).toEqual([
			['error', 'Fuente A'],
			['info', 'Fuente A']
		]);
		expect(lines[0].msg).toContain('2 pasadas');
	});

	it('lee notify-log sin romperse con basura', () => {
		expect(fromNotifyLog(null)).toEqual([]);
		const lines = fromNotifyLog([{ k: 'quake:us123', t: iso(10), s: 'sent', p: 1 }, { k: 'luz:2026-10-16', t: iso(20), s: 'failed', p: 3 }, { nope: 1 }]);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatchObject({ level: 'aviso', kind: 'movil', origin: 'Móvil · P1' });
		expect(lines[0].msg).toContain('Terremoto');
		expect(lines[1].level).toBe('error');
	});

	it('notificaciones y sesión', () => {
		const n = fromNotices([{ id: 'x', kind: 'novedad', title: 'Nueva app', detail: '', time: iso(5) }]);
		expect(n[0]).toMatchObject({ level: 'info', kind: 'sistema', msg: 'Nueva app' });
		const ses = fromSession([{ t: iso(1), what: 'abre', app: 'Reloj' }]);
		expect(ses[0].msg).toBe('Abre Reloj');
	});

	it('ordena, filtra por nivel, origen, texto e intervalo', () => {
		const lines = sortLines([
			...fromStatus([s('fred', 'error', null), s('ecb', 'ok', 60 * 24 * 3)], now),
			...fromSession([{ t: iso(1), what: 'abre', app: 'Reloj' }])
		]);
		expect(lines[0].kind).toBe('sesion');
		expect(lines.at(-1)!.t).toBeNull();
		expect(filterLines(lines, { ...base, levels: ['error'] }).map((l) => l.origin)).toEqual(['FRED']);
		expect(filterLines(lines, { ...base, origin: 'ECB' })).toHaveLength(1);
		expect(filterLines(lines, { ...base, words: ['reloj'] })).toHaveLength(1);
		expect(filterLines(lines, { ...base, kinds: ['fuente'] })).toHaveLength(2);
		// Hoy: la sesión y la fuente sin hora (su estado actual); la de hace 3 días, no.
		expect(filterLines(lines, { ...base, range: 'hoy' }).map((l) => l.origin).sort()).toEqual(['FRED', 'Sesión']);
		expect(filterLines(lines, { ...base, range: '7d' })).toHaveLength(3);
		expect(rangeStart('todo', now)).toBe(-Infinity);
		expect(origins(lines)).toEqual(['ECB', 'FRED', 'Sesión']);
	});

	it('resumen y CSV', () => {
		const st = [s('a', 'ok', 5), s('b', 'error', null), s('c', 'off', null)];
		const lines = fromStatus(st, now);
		expect(summarize(lines, st, now)).toEqual({ errors: 1, warnings: 0, fresh: 1, active: 2 });
		const csv = linesCsv([{ id: '1', t: '2026-10-15T10:00:00Z', level: 'error', kind: 'fuente', origin: 'FRED', msg: 'Falló; reintento' }]);
		expect(csv.startsWith('﻿Hora;Nivel;Origen;Mensaje\r\n')).toBe(true);
		expect(csv).toContain('2026-10-15T10:00:00Z;Error;FRED;"Falló; reintento"');
	});
});
