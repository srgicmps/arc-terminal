import { describe, expect, it } from 'vitest';
import { latestQuote, recent, whySentence } from './why.ts';

const now = Date.parse('2026-10-15T12:00:00Z');
const q = (symbol: string, changePct: number | null, time: string) => ({ symbol, price: 1, change: null, changePct, prevClose: null, time });

describe('recent', () => {
	it('se queda con las 24 h y ordena del más nuevo al más viejo', () => {
		const items = [
			{ id: 'a', time: '2026-10-14T13:00:00Z' },
			{ id: 'b', time: '2026-10-14T11:00:00Z' },
			{ id: 'c', time: '2026-10-15T11:00:00Z' },
			{ id: 'd', time: null }
		];
		expect(recent(items, now).map((i) => i.id)).toEqual(['c', 'a']);
	});
});

describe('latestQuote', () => {
	it('elige la más reciente del símbolo con variación', () => {
		const a = [q('NVDA', 1, '2026-10-15T10:00:00Z'), q('AAPL', 2, '2026-10-15T11:00:00Z')];
		const b = [q('NVDA', -1, '2026-10-15T11:00:00Z'), q('NVDA', null, '2026-10-15T11:30:00Z')];
		expect(latestQuote('NVDA', a, b)?.changePct).toBe(-1);
		expect(latestQuote('TSLA', a, null)).toBeNull();
	});
});

describe('whySentence', () => {
	it('junta la variación y los titulares', () => {
		expect(whySentence('NVIDIA', 2.34, 4)).toBe('NVIDIA sube un 2,3 % y sale en 4 titulares de las últimas 24 h.');
		expect(whySentence('Apple', -0.01, 1)).toBe('Apple está plana y sale en 1 titular de las últimas 24 h.');
		expect(whySentence('Tesla', null, 0)).toBe('Tesla no sale en titulares de las últimas 24 h.');
	});
});

describe('fechas con zona (QA T5)', () => {
	it('recent y latestQuote ordenan por la hora real, no por el texto', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		const items = [
			{ time: '2026-10-15T11:30:00+02:00', id: 'a' }, // 09:30 Z
			{ time: '2026-10-15T10:00:00Z', id: 'b' }
		];
		expect(recent(items, now).map((i) => i.id)).toEqual(['b', 'a']);
		const q = (time: string, changePct: number) => ({ symbol: 'NVDA', price: 1, change: 0, changePct, time }) as never;
		expect(latestQuote('NVDA', [q('2026-10-15T11:30:00+02:00', 1), q('2026-10-15T10:00:00Z', 2)])?.changePct).toBe(2);
	});
});
