// Fed de Nueva York: muestra con la forma documentada de la Markets Data API.
import { describe, expect, it } from 'vitest';
import { parseRefRates } from '../sources/nyfed.ts';

describe('parseRefRates', () => {
	it('ordena del más antiguo al más reciente y guarda el volumen', () => {
		const body = {
			refRates: [
				{ effectiveDate: '2026-10-14', type: 'SOFR', percentRate: 4.31, volumeInBillions: 2512 },
				{ effectiveDate: '2026-10-13', type: 'SOFR', percentRate: '4.30', volumeInBillions: null },
				{ effectiveDate: 'mal', percentRate: 1 }
			]
		};
		expect(parseRefRates(body)).toEqual([
			{ t: '2026-10-13', v: 4.3, vol: null },
			{ t: '2026-10-14', v: 4.31, vol: 2512 }
		]);
	});

	it('sin refRates devuelve una lista vacía', () => {
		expect(parseRefRates({ error: 'x' })).toEqual([]);
	});
});
