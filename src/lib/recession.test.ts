import { describe, expect, it } from 'vitest';
import { recessionSignals } from './recession.ts';
import type { Series } from './types.ts';

const s = (id: string, values: number[], daily = false): Series => ({
	id,
	label: id,
	unit: '%',
	source: 'FRED',
	url: `https://fred.stlouisfed.org/series/${id}`,
	points: values.map((v, i) => ({ t: daily ? `2026-09-${String(i + 1).padStart(2, '0')}` : `2026-${String(i + 1).padStart(2, '0')}`, v }))
});

describe('recessionSignals', () => {
	it('Sahm y probabilidad se activan desde el umbral (incluido)', () => {
		const on = recessionSignals(s('sahm', [0.2, 0.5]), s('prob', [10, 50]), null);
		expect(on.sahm).toMatchObject({ value: 0.5, t: '2026-02', active: true });
		expect(on.prob).toMatchObject({ value: 50, active: true });
		const off = recessionSignals(s('sahm', [0.6, 0.49]), s('prob', [80, 49.9]), null);
		expect(off.sahm!.active).toBe(false);
		expect(off.prob!.active).toBe(false);
	});

	it('la curva mira la media de las últimas 20 sesiones, no un solo día', () => {
		// 19 días positivos y uno negativo: sigue sin activarse.
		const blip = recessionSignals(null, null, s('curve', [...Array(19).fill(0.3), -0.1], true));
		expect(blip.curve).toMatchObject({ value: -0.1, active: false });
		// Invertida de forma sostenida, aunque el último día salga positivo.
		const inverted = recessionSignals(null, null, s('curve', [...Array(10).fill(1), ...Array(19).fill(-0.4), 0.05], true));
		expect(inverted.curve).toMatchObject({ value: 0.05, active: true });
		// Con menos de 20 sesiones, la media de las que haya.
		expect(recessionSignals(null, null, s('curve', [-0.2, 0.1], true)).curve!.active).toBe(true);
	});

	it('sin serie o sin puntos, esa señal es null y el resto sigue', () => {
		const r = recessionSignals(undefined, s('prob', []), s('curve', [0.5], true));
		expect(r.sahm).toBeNull();
		expect(r.prob).toBeNull();
		expect(r.curve).toMatchObject({ value: 0.5, active: false, url: 'https://fred.stlouisfed.org/series/curve' });
	});
});
