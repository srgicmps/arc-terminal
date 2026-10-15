import { describe, expect, it } from 'vitest';
import { LIGHT_RULES, level, riskLights, vixRatio } from './risk-lights.ts';
import type { Series, VixData } from './types.ts';

const rule = (id: string) => LIGHT_RULES.find((r) => r.id === id)!;
const series = (id: string, v: number): Series => ({ id, label: id, unit: '', points: [{ t: '2026-10-14', v }], source: 'x' });

describe('semáforo de riesgo', () => {
	it('sube de calma a tensión en sus umbrales', () => {
		expect(level(rule('vix'), 19.9)).toBe('calm');
		expect(level(rule('vix'), 20)).toBe('watch');
		expect(level(rule('vix'), 30)).toBe('stress');
		// STLFSI: hay que pasar el umbral.
		expect(level(rule('stlfsi'), 0)).toBe('calm');
		expect(level(rule('stlfsi'), 1)).toBe('watch');
		expect(level(rule('stlfsi'), 1.01)).toBe('stress');
	});

	it('en la curva de tipos, el riesgo está abajo', () => {
		expect(level(rule('curve'), 0.3)).toBe('calm');
		expect(level(rule('curve'), 0)).toBe('calm');
		expect(level(rule('curve'), -0.2)).toBe('watch');
		expect(level(rule('curve'), -0.5)).toBe('watch');
		expect(level(rule('curve'), -0.8)).toBe('stress');
	});

	it('calcula la curva del VIX con el último día que tenga los dos plazos', () => {
		const vix: VixData = {
			tenors: ['9D', '1M', '3M'],
			days: [
				{ date: '2026-10-13', values: [20, 22, 20] },
				{ date: '2026-10-14', values: [18, 19, null] }
			]
		};
		expect(vixRatio(vix)).toEqual({ t: '2026-10-13', v: 1.1 });
	});

	it('usa el VIX de Cboe antes que el de FRED y omite lo que falta', () => {
		const vix: VixData = { tenors: ['1M', '3M'], days: [{ date: '2026-10-14', values: [32, 30] }] };
		const map = new Map([series('vix', 15), series('t10y3m-us', -0.1), series('epu-global', 250)].map((s) => [s.id, s]));
		const lights = riskLights({ get: (id) => map.get(id), vix });
		expect(lights.map((l) => [l.id, l.value, l.level])).toEqual([
			['vix', '32,0', 'stress'],
			['vix-curve', '1,07', 'stress'],
			['curve', '−0,10 %', 'watch'],
			['epu', '250', 'watch']
		]);
	});
});
