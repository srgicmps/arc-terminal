// Cuota de la hipoteca: se compara con cuotas calculadas a mano y con los casos límite.
import { describe, expect, it } from 'vitest';
import { lastAndYearAgo, monthlyPayment } from './mortgage.ts';
import type { Series } from './types.ts';

describe('monthlyPayment', () => {
	it('da la cuota del sistema francés', () => {
		// 150.000 € a 25 años al 3 %: 711,32 €/mes.
		expect(monthlyPayment(150_000, 25, 3)).toBeCloseTo(711.32, 2);
		// 200.000 € a 30 años al 2,5 %: 790,24 €/mes.
		expect(monthlyPayment(200_000, 30, 2.5)).toBeCloseTo(790.24, 2);
		// 100.000 € a 20 años al 4,25 %: 619,23 €/mes.
		expect(monthlyPayment(100_000, 20, 4.25)).toBeCloseTo(619.23, 2);
	});

	it('con interés 0 o negativo, reparte el capital a partes iguales', () => {
		expect(monthlyPayment(120_000, 10, 0)).toBe(1000);
		expect(monthlyPayment(120_000, 10, -0.3)).toBe(1000);
	});

	it('sube con el tipo', () => {
		const a = monthlyPayment(150_000, 25, 2.2)!;
		const b = monthlyPayment(150_000, 25, 3.2)!;
		expect(b - a).toBeGreaterThan(0);
	});

	it('devuelve null si faltan datos', () => {
		expect(monthlyPayment(0, 25, 3)).toBeNull();
		expect(monthlyPayment(150_000, 0, 3)).toBeNull();
		expect(monthlyPayment(Number.NaN, 25, 3)).toBeNull();
		expect(monthlyPayment(150_000, 25, Number.NaN)).toBeNull();
	});
});

describe('lastAndYearAgo', () => {
	const euribor: Series = {
		id: 'euribor-12m',
		label: 'Euríbor a 12 meses',
		unit: '%',
		points: [
			{ t: '2025-08', v: 2.11 },
			{ t: '2025-09', v: 2.17 },
			{ t: '2026-08', v: 2.35 },
			{ t: '2026-09', v: 2.4 }
		],
		source: 'BCE'
	};

	it('da el último mes y el mismo mes de un año antes', () => {
		expect(lastAndYearAgo(euribor)).toEqual({ now: { t: '2026-09', v: 2.4 }, before: { t: '2025-09', v: 2.17 } });
	});

	it('sin el dato de hace un año, before es null', () => {
		expect(lastAndYearAgo({ ...euribor, points: euribor.points.slice(2) })?.before).toBeNull();
		expect(lastAndYearAgo(undefined)).toBeNull();
	});
});
