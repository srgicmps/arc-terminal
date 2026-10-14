import { describe, expect, it } from 'vitest';
import { afterMove, flagged, formatClock, makeClock, pause, remaining } from './clock.ts';

describe('reloj', () => {
	it('crea el reloj de cada ritmo', () => {
		expect(makeClock('none')).toBeNull();
		expect(makeClock('15+10')).toEqual({ base: 900_000, inc: 10_000, w: 900_000, b: 900_000, since: null });
	});

	it('arranca con la primera jugada de las blancas, sin descontarles nada', () => {
		const c = afterMove(makeClock('5+3')!, 'w', 1000);
		expect(c.w).toBe(300_000);
		expect(c.since).toBe(1000);
		expect(remaining(c, 'b', 'b', 6000)).toBe(295_000);
		expect(remaining(c, 'w', 'b', 6000)).toBe(300_000);
	});

	it('descuenta lo pensado y suma el incremento', () => {
		const c = afterMove(afterMove(makeClock('5+3')!, 'w', 0), 'b', 10_000);
		expect(c.b).toBe(300_000 - 10_000 + 3000);
	});

	it('pausa y bandera', () => {
		const c = afterMove(makeClock('5+3')!, 'w', 0);
		const p = pause(c, 'b', 4000);
		expect(p).toMatchObject({ b: 296_000, since: null });
		expect(flagged(p, 'b', 10_000_000)).toBeNull();
		expect(flagged(c, 'b', 299_999)).toBeNull();
		expect(flagged(c, 'b', 300_000)).toBe('b');
		expect(remaining(c, 'b', 'b', 400_000)).toBe(0);
	});

	it('formato', () => {
		expect(formatClock(300_000)).toBe('5:00');
		expect(formatClock(61_200)).toBe('1:02');
		expect(formatClock(9_960)).toBe('0:09.9');
		expect(formatClock(-5)).toBe('0:00.0');
	});
});
