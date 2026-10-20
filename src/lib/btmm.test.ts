import { describe, expect, it } from 'vitest';
import { gap, gapOn, moneyRow, tenorSeries } from './btmm.ts';
import type { Series } from './types.ts';

const s = (id: string, points: [string, number][]): Series => ({ id, label: id, unit: '%', points: points.map(([t, v]) => ({ t, v })), source: 'x' });

describe('moneyRow', () => {
	it('cambio diario y mensual en pb, con el volumen del mismo día', () => {
		const sofr = s('sofr', [['2026-09-10', 4.1], ['2026-10-13', 4.3], ['2026-10-14', 4.31]]);
		const vol = s('vol', [['2026-10-14', 2500]]);
		expect(moneyRow(sofr, 'SOFR', vol)).toEqual({ id: 'sofr', label: 'SOFR', v: 4.31, t: '2026-10-14', d: 1, m: 21, vol: 2500 });
	});

	it('series mensuales: compara con el mes anterior', () => {
		const eur = s('euribor', [['2026-08', 2.1], ['2026-09', 2.05]]);
		expect(moneyRow(eur)).toMatchObject({ d: -5, m: -5 });
		expect(moneyRow(undefined)).toBeNull();
	});
});

describe('tenorSeries y gap', () => {
	it('saca un plazo de la curva sin huecos y resta en pb', () => {
		const curve = { tenors: ['1M', '3M'], days: [{ date: '2026-10-13', values: [4.2, null] }, { date: '2026-10-14', values: [4.25, 4.1] }] };
		expect(tenorSeries(curve, '3M', 'bill3m', 'Letra 3M')?.points).toEqual([{ t: '2026-10-14', v: 4.1 }]);
		expect(tenorSeries(curve, '1A', 'x', 'x')).toBeUndefined();
		const a = moneyRow(tenorSeries(curve, '1M', 'a', 'a'));
		const b = moneyRow(tenorSeries(curve, '3M', 'b', 'b'));
		expect(gap(a, b)).toBe(15);
	});
});

describe('gapOn (frases del modo Sencillo)', () => {
	// La facilidad de depósito solo trae los días en que cambia; el €STR de un día sale al siguiente.
	const dfr = s('ecb-dfr', [['2025-06-11', 2], ['2026-06-17', 2.25], ['2026-09-16', 2.5]]);

	it('el día en que el BCE cambia el tipo, el €STR de la víspera va con el tipo de antes', () => {
		// Sube del 2,25 al 2,50 el 16 y el último €STR es del 15: −7 pb, no −32 («dinero de sobra» por error).
		const estr = s('estr', [['2026-09-14', 2.181], ['2026-09-15', 2.18]]);
		expect(gapOn(estr, dfr, true)).toBe(-7);
		// Con el €STR del día 16, ya con el tipo nuevo.
		expect(gapOn(s('estr', [['2026-09-15', 2.18], ['2026-09-16', 2.43]]), dfr, true)).toBe(-7);
		// Bajada que entra hoy (del 2,50 al 2,25) con el €STR de ayer (2,44): −6 pb, no +19 («hay tensión» por error).
		const cut = s('ecb-dfr', [['2026-09-16', 2.5], ['2026-10-21', 2.25]]);
		expect(gapOn(s('estr', [['2026-10-20', 2.44]]), cut, true)).toBe(-6);
	});

	it('dos series diarias (SOFR e IORB): el último día que tienen las dos', () => {
		// La Fed baja el IORB del 3,90 al 3,65 el 30; SOFR aún no tiene ese día: se comparan el 29.
		const iorb = s('iorb', [['2026-10-29', 3.9], ['2026-10-30', 3.65]]);
		expect(gapOn(s('sofr', [['2026-10-28', 3.88], ['2026-10-29', 3.89]]), iorb)).toBe(-1);
		// Al revés: SOFR ya tiene el 30 (con el tipo nuevo) e IORB no. Se comparan el 29, no SOFR nuevo con IORB viejo.
		const sofr = s('sofr', [['2026-10-29', 3.89], ['2026-10-30', 3.64]]);
		expect(gapOn(sofr, s('iorb', [['2026-10-28', 3.9], ['2026-10-29', 3.9]]))).toBe(-1);
		expect(gapOn(sofr, iorb)).toBe(-1);
	});

	it('sin una de las dos, o sin un dato de antes, no hay diferencial', () => {
		expect(gapOn(undefined, dfr, true)).toBeNull();
		expect(gapOn(s('estr', []), dfr, true)).toBeNull();
		expect(gapOn(s('estr', [['2025-01-02', 2.9]]), dfr, true)).toBeNull();
	});
});
