import { describe, expect, it } from 'vitest';
import { compact, dm, hm, longDay, nf, period, signed, trend, weekday, when } from './format.ts';

describe('números', () => {
	it('nf: formato español con decimales fijos', () => {
		expect(nf(1.5)).toBe('1,50');
		expect(nf(12345.678, 1)).toBe('12.345,7');
		expect(nf(-0.126, 2)).toBe('-0,13');
		// Sin «-0»: ni el -0 de JavaScript ni un negativo que se redondea a cero (ejes de LineChart).
		expect(nf(-0, 1)).toBe('0,0');
		expect(nf(-0.001, 2)).toBe('0,00');
		expect(nf(-1.1e-16, 0)).toBe('0');
		// En español los números de cuatro cifras no llevan punto de miles.
		expect(nf(1234.5)).toBe('1234,50');
	});

	it('trend con decimales: lo que se redondea a cero es plano', () => {
		expect(trend(0.004, 2)).toBe('flat');
		expect(trend(-2.7e-17, 1)).toBe('flat');
		expect(trend(0.006, 2)).toBe('up');
		expect(trend(0.004)).toBe('up');
	});

	it('nf, signed y compact ponen una raya si no hay número', () => {
		for (const f of [nf, signed, compact]) {
			expect(f(null)).toBe('—');
			expect(f(undefined)).toBe('—');
			expect(f(NaN)).toBe('—');
			expect(f(Infinity)).toBe('—');
		}
	});

	it('signed: con signo más o con el signo menos tipográfico', () => {
		expect(signed(0.25)).toBe('+0,25');
		expect(signed(-1.3)).toBe('−1,30');
		expect(signed(0)).toBe('0,00');
		expect(signed(-0.001)).toBe('0,00');
		expect(signed(0.004, 2)).toBe('0,00');
		expect(signed(-2, 0)).toBe('−2');
	});

	it('trend: sube, baja o plano', () => {
		expect(trend(0.1)).toBe('up');
		expect(trend(-0.1)).toBe('down');
		expect(trend(0)).toBe('flat');
		expect(trend(null)).toBe('flat');
		expect(trend(NaN)).toBe('flat');
	});

	it('compact: escala larga española', () => {
		expect(compact(38.1e12)).toBe('38,10 bill.');
		expect(compact(1.9e9)).toBe('1,9 mil M');
		expect(compact(2.4e6)).toBe('2,4 M');
		expect(compact(15_300)).toBe('15,3 mil');
		expect(compact(182_000)).toBe('182 mil');
		expect(compact(3e6)).toBe('3 M');
		expect(compact(-2.4e6)).toBe('-2,4 M');
		expect(compact(999)).toBe('999');
	});
});

describe('fechas (hora de Madrid)', () => {
	it('hm y dm', () => {
		expect(hm('2026-10-14T12:05:00Z')).toBe('14:05');
		expect(hm('2026-01-14T12:05:00Z')).toBe('13:05');
		expect(dm('2026-10-14T12:00:00Z')).toBe('14 oct');
		// Pasada la medianoche de Madrid ya es el día siguiente.
		expect(dm('2026-10-14T22:30:00Z')).toBe('15 oct');
	});

	it('dm y period abrevian igual todos los meses («sep», no «sept»)', () => {
		for (let m = 1; m <= 12; m++) {
			const mm = String(m).padStart(2, '0');
			expect(dm(`2026-${mm}-14T12:00:00Z`)).toBe(period(`2026-${mm}-14`));
		}
		expect(dm('2026-09-14T12:00:00Z')).toBe('14 sep');
	});

	it('longDay y weekday', () => {
		expect(longDay('2026-10-14T12:00:00Z')).toBe('miércoles, 14 de octubre de 2026');
		expect(weekday('2026-10-14')).toBe('mié 14');
	});

	it('when: relativo si es reciente, fecha y hora si no', () => {
		const now = Date.parse('2026-10-14T12:00:00Z');
		expect(when('2026-10-14T11:59:40Z', now)).toBe('ahora');
		expect(when('2026-10-14T11:55:00Z', now)).toBe('hace 5 min');
		expect(when('2026-10-14T09:00:00Z', now)).toBe('hace 3 h');
		expect(when('2026-10-14', now)).toBe('14 oct');
		expect(when('2026-10-12T09:30:00Z', now)).toBe('12 oct 11:30');
		// Fechas en el futuro (relojes desajustados): fecha absoluta.
		expect(when('2026-10-14T12:30:00Z', now)).toBe('14 oct 14:30');
	});

	it('when: sin reloj (now = 0) siempre da la fecha absoluta, para que el HTML coincida', () => {
		expect(when('2026-10-14T11:55:00Z', 0)).toBe('14 oct 13:55');
	});

	it('when: vacío si no hay fecha o no se entiende', () => {
		expect(when(null, 1)).toBe('');
		expect(when(undefined, 1)).toBe('');
		expect(when('mañana', 1)).toBe('');
	});

	it('period: meses, trimestres y días de las series', () => {
		expect(period('2026-09')).toBe('sep 26');
		expect(period('2026-Q2')).toBe('T2 26');
		expect(period('2026-W41')).toBe('sem 41 26');
		expect(period('2026-10-14')).toBe('14 oct');
		// Un instante ISO: la hora de Madrid (19:05 UTC son las 21:05 en octubre).
		expect(period('2026-10-14T19:05:00.000Z')).toBe('21:05');
		expect(period('2026-01-05')).toBe('5 ene');
		expect(period('2026')).toBe('2026');
	});
});

describe('nf con formateadores guardados', () => {
	// La versión anterior de nf(), con toLocaleString: la de ahora tiene que dar exactamente lo mismo.
	const before = (n: number, decimals: number) => {
		const s = n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
		return /^-0(,0+)?$/.test(s) ? s.slice(1) : s;
	};
	const edges = [0, -0, 0.5, -0.5, 0.005, -0.005, 1.005, 2.5, -2.5, 999.995, 1234.5, 9999.5, 12345.678, -98765.4321, 1e15, -1e-7, 1.1e-16];
	// Números repartidos de forma fija (sin Math.random, para que el test sea siempre igual).
	const spread = Array.from({ length: 1500 }, (_, i) => Math.sin(i * 12.9898) * 10 ** ((i % 9) - 3));

	it('da lo mismo que toLocaleString, con los decimales mezclados (0, 2, 0…)', () => {
		[...edges, ...spread].forEach((n, i) => {
			const d = [0, 2, 0, 1, 3][i % 5];
			expect(nf(n, d), `nf(${n}, ${d})`).toBe(before(n, d));
		});
		for (const d of [0, 1, 2, 3, 4]) for (const n of edges) expect(nf(n, d), `nf(${n}, ${d})`).toBe(before(n, d));
	});

	it('la caché no mezcla decimales; signed y compact siguen igual', () => {
		expect([nf(1.5, 0), nf(1.5, 2), nf(1.5, 0)]).toEqual(['2', '1,50', '2']);
		expect(signed(-0.004, 2)).toBe('0,00');
		expect(compact(182_000)).toBe('182 mil');
		expect(compact(38.1e12)).toBe('38,10 bill.');
	});
});
