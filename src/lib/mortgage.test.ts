// Cuota de la hipoteca: se compara con cuotas calculadas a mano y con los casos límite.
import { describe, expect, it } from 'vitest';
import { amortization, balanceAfter, firstYearPaid, lastAndYearAgo, monthlyPayment, nextReview } from './mortgage.ts';
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

describe('amortization', () => {
	it('suma el capital y cuadra intereses con las cuotas', () => {
		const rows = amortization(150_000, 25, 3);
		expect(rows).toHaveLength(25);
		const principal = rows.reduce((s, r) => s + r.principal, 0);
		const paid = rows.reduce((s, r) => s + r.paid, 0);
		const interest = rows.reduce((s, r) => s + r.interest, 0);
		expect(principal).toBeCloseTo(150_000, 6);
		expect(paid).toBeCloseTo(principal + interest, 6);
		// 300 cuotas de 711,32 €: 213.395 € en total.
		expect(paid).toBeCloseTo(711.32 * 300, -1);
		expect(rows.at(-1)!.balance).toBe(0);
		// Al principio se pagan más intereses que capital; al final, al revés.
		expect(rows[0].interest).toBeGreaterThan(rows[0].principal);
		expect(rows.at(-1)!.interest).toBeLessThan(rows.at(-1)!.principal);
	});

	it('sin datos válidos, cuadro vacío', () => {
		expect(amortization(0, 25, 3)).toEqual([]);
	});
});

describe('balanceAfter', () => {
	it('coincide con el cuadro al cerrar el primer año', () => {
		expect(balanceAfter(150_000, 25, 3, 12)).toBeCloseTo(amortization(150_000, 25, 3)[0].balance, 6);
		expect(balanceAfter(150_000, 25, 3, 0)).toBe(150_000);
	});
});

describe('nextReview', () => {
	const oct = new Date('2026-10-15T12:00:00Z');
	it('anual: este mes, más adelante o el año que viene', () => {
		expect(nextReview(10, 12, oct)).toEqual({ ym: '2026-10', months: 0 });
		expect(nextReview(12, 12, oct)).toEqual({ ym: '2026-12', months: 2 });
		expect(nextReview(3, 12, oct)).toEqual({ ym: '2027-03', months: 5 });
	});
	it('semestral: la primera de las dos', () => {
		expect(nextReview(1, 6, oct)).toEqual({ ym: '2027-01', months: 3 });
		expect(nextReview(3, 6, oct)).toEqual({ ym: '2027-03', months: 5 });
		expect(nextReview(5, 6, oct)).toEqual({ ym: '2026-11', months: 1 });
	});
	it('mes no válido', () => {
		expect(nextReview(13, 12, oct)).toBeNull();
	});
});

describe('nextReview en hora de España', () => {
	it('el 1 de noviembre a las 00:30 de Madrid ya es noviembre (en UTC aún es 31 de octubre)', () => {
		const night = new Date('2026-10-31T23:30:00Z');
		expect(nextReview(11, 12, night)).toEqual({ ym: '2026-11', months: 0 });
	});
	it('la Nochevieja de Madrid ya es el año nuevo', () => {
		expect(nextReview(1, 12, new Date('2026-12-31T23:30:00Z'))).toEqual({ ym: '2027-01', months: 0 });
	});
});

describe('firstYearPaid', () => {
	it('con muchos años, 12 cuotas', () => {
		const pay = monthlyPayment(150000, 25, 3)!;
		expect(firstYearPaid(150000, 25, 3)).toBeCloseTo(pay * 12, 6);
	});
	it('si quedan menos de 12 cuotas, solo esas (antes salía cuota × 12)', () => {
		// Un mes al 3 %: se paga el capital y un mes de intereses.
		expect(firstYearPaid(150000, 1 / 12, 3)).toBeCloseTo(150375, 6);
		const rows = amortization(150000, 0.5, 3);
		expect(firstYearPaid(150000, 0.5, 3)).toBeCloseTo(rows[0].paid, 6);
	});
	it('sin datos válidos, null', () => {
		expect(firstYearPaid(0, 25, 3)).toBeNull();
	});
});
