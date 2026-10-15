import { describe, expect, it } from 'vitest';
import type { SourceStatus } from '../../../data.ts';
import { ageText, late, sortProcs, summary } from './procs.ts';

const now = Date.parse('2026-10-15T12:00:00Z');
const s = (name: string, state: SourceStatus['state'], minAgo: number | null, maxAgeMinutes = 30): SourceStatus => ({
	name,
	label: name,
	state,
	fetchedAt: minAgo === null ? null : new Date(now - minAgo * 60_000).toISOString(),
	maxAgeMinutes
});

describe('Monitor del sistema', () => {
	const list = [s('b', 'ok', 5), s('a', 'error', null), s('c', 'off', null), s('d', 'stale', 200)];

	it('ordena por gravedad, nombre y antigüedad', () => {
		expect(sortProcs(list, 'state', now).map((x) => x.name)).toEqual(['a', 'd', 'c', 'b']);
		expect(sortProcs(list, 'name', now).map((x) => x.name)).toEqual(['a', 'b', 'c', 'd']);
		expect(sortProcs(list, 'age', now)[0].name).toBe('a');
	});

	it('resume la salud sin contar las que no tienen clave', () => {
		const r = summary(list);
		expect(r.count.error).toBe(1);
		expect(r.health).toBe(33);
	});

	it('textos y retrasos', () => {
		expect(ageText(5)).toBe('5 min');
		expect(ageText(180)).toBe('3 h');
		expect(ageText(null)).toBe('—');
		expect(late(list[3], now)).toBe(true);
		expect(late(list[0], now)).toBe(false);
	});
});
