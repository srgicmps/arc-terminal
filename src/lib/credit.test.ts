import { describe, expect, it } from 'vitest';
import { versusYear } from './credit.ts';

describe('diferenciales de crédito', () => {
	it('compara el último dato con la media de su último año', () => {
		const pts = [
			{ t: '2025-09-01', v: 9 }, // más de un año: no cuenta
			{ t: '2025-11-01', v: 3 },
			{ t: '2026-05-01', v: 3 },
			{ t: '2026-10-14', v: 4.5 }
		];
		expect(versusYear(pts)).toEqual({ last: 4.5, mean: 3.5, above: true });
		expect(versusYear([{ t: '2026-10-14', v: 2 }])?.above).toBe(false);
		expect(versusYear([])).toBeNull();
	});
});
