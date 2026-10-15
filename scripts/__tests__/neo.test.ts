// Asteroides cercanos (NASA JPL, cad.api): filas con los campos en el orden de `fields`.
import { describe, expect, it } from 'vitest';
import { cadDate, parseCad } from '../sources/neo.ts';

const fields = ['des', 'orbit_id', 'jd', 'cd', 'dist', 'dist_min', 'dist_max', 'v_rel', 'v_inf', 't_sigma_f', 'h', 'diameter', 'diameter_sigma', 'fullname'];
const row = (des: string, cd: string, dist: string, h: string | null, diameter: string | null) =>
	[des, '1', '0', cd, dist, dist, dist, '10.29', '10.1', '< 00:01', h, diameter, null, ` (${des})`];

describe('neo', () => {
	it('distancia en distancias lunares, fecha en ISO y tamaño medido o estimado por el brillo', () => {
		const out = parseCad({
			fields,
			data: [
				row('2026 TG9', '2026-Oct-14 04:58', '0.00152372675907695', '27.27', null),
				row('2026 TP6', '2026-Oct-15 00:01', '0.00146363563551003', '27.259', null),
				row('Apophis', '2026-Nov-01 12:00', '0.02', '19.7', '0.34'),
				row('roto', 'ayer', '0.001', '20', null)
			]
		});
		expect(out.map((p) => p.des)).toEqual(['2026 TP6', '2026 TG9', 'Apophis']);
		expect(out[0]).toEqual({ des: '2026 TP6', date: '2026-10-15T00:01:00.000Z', ld: 0.57, speed: 10.29, size: { min: 9, max: 21, measured: false } });
		expect(out[2].size).toEqual({ min: 340, max: 340, measured: true });
	});

	it('cadDate solo entiende «AAAA-Mes-DD hh:mm»', () => {
		expect(cadDate('2026-Dec-01 23:59')).toBe('2026-12-01T23:59:00.000Z');
		expect(cadDate('2026-13-01')).toBeNull();
	});

	it('sin datos, lista vacía', () => {
		expect(parseCad({ count: 0 })).toEqual([]);
	});
});
