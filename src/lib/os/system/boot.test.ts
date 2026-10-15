import { describe, expect, it } from 'vitest';
import type { Notice } from '../shell/notices.ts';
import { bootDue, dayKey, greeting, lockSummary, startPhase, userName } from './boot.ts';

const n = (id: string, kind: Notice['kind'] = 'aviso'): Notice => ({ id, kind, title: id, detail: '', time: '2026-10-15T10:00:00Z' });

describe('arranque', () => {
	it('al recargar, una pestaña bloqueada sigue bloqueada', () => {
		const now = new Date(2026, 9, 15, 9, 0);
		expect(startPhase(true, null, now, false)).toBe('boot');
		expect(startPhase(true, '2026-10-15', now, true)).toBe('lock');
		expect(startPhase(true, '2026-10-15', now, false)).toBe('on');
		expect(startPhase(false, null, now, true)).toBe('lock');
		expect(startPhase(false, null, now, false)).toBe('on');
	});
	it('sale una vez al día', () => {
		const now = new Date(2026, 9, 15, 9, 0);
		expect(dayKey(now)).toBe('2026-10-15');
		expect(bootDue(null, now)).toBe(true);
		expect(bootDue('2026-10-15', now)).toBe(false);
		expect(bootDue('2026-10-14', now)).toBe(true);
	});

	it('saluda según la hora', () => {
		expect(greeting(8)).toBe('Buenos días');
		expect(greeting(16)).toBe('Buenas tardes');
		expect(greeting(23)).toBe('Buenas noches');
		expect(greeting(3)).toBe('Buenas noches');
	});
});

describe('bloqueo', () => {
	it('cuenta los avisos sin leer y deja fuera lo leído', () => {
		const s = lockSummary([n('a'), n('b'), n('c', 'novedad')], ['b']);
		expect(s.headline).toBe('1 aviso sin leer');
		expect(s.items.map((i) => i.id)).toEqual(['a', 'c']);
	});

	it('sin avisos, lo dice; solo novedades, las cuenta', () => {
		expect(lockSummary([], []).headline).toBe('Sin avisos nuevos');
		expect(lockSummary([n('x', 'novedad'), n('y', 'novedad')], []).headline).toBe('2 novedades de Arc');
	});
});

describe('usuario', () => {
	it('saca el nombre del email', () => {
		expect(userName('ana.garcia@example.com')).toBe('Ana');
		expect(userName('')).toBe('');
	});
});
