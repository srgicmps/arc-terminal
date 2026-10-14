import { describe, expect, it } from 'vitest';
import { computeRisk, lastYear, recessionOdds, riskLabel, spread, weeklyChanges, zScore } from './risk.ts';
import type { Point, Series } from './types.ts';

/** Serie diaria de `n` días hasta el 2026-10-14, con valores dados por `f(i)`. */
function daily(n: number, f: (i: number) => number): Point[] {
	return Array.from({ length: n }, (_, i) => {
		const d = new Date(Date.UTC(2026, 9, 14 - (n - 1 - i)));
		return { t: d.toISOString().slice(0, 10), v: f(i) };
	});
}

const series = (id: string, points: Point[]): Series => ({ id, label: id, unit: '', points, source: 'x' });

describe('termómetro de riesgo', () => {
	it('z-score del último valor', () => {
		expect(zScore([1, 2])).toBeNull(); // muy pocos datos
		const v = Array.from({ length: 20 }, (_, i) => (i % 2 ? 1 : -1));
		expect(zScore(v)).toBeCloseTo(1);
		expect(zScore(Array(30).fill(5))).toBeNull(); // sin variación
	});

	it('se queda con el último año', () => {
		const pts = daily(500, (i) => i);
		const year = lastYear(pts);
		expect(year[0].t).toBe('2025-10-14');
		expect(year.at(-1)!.t).toBe('2026-10-14');
	});

	it('primas en puntos básicos y variaciones semanales', () => {
		expect(
			spread(
				[
					{ t: '2026-09', v: 3.5 },
					{ t: '2026-10', v: 3.6 }
				],
				[{ t: '2026-10', v: 2.6 }]
			)
		).toEqual([{ t: '2026-10', v: 1 }]);
		const hist = daily(8, (i) => 100 + i).map((p) => ({ date: p.t, usd: p.v }));
		const w = weeklyChanges(hist);
		expect(w).toHaveLength(1);
		expect(w[0].t).toBe('2026-10-14');
		expect(w[0].v).toBeCloseTo(7);
	});

	it('VIX disparado y curva invertida: risk-off', () => {
		const vix = daily(260, (i) => (i === 259 ? 40 : 15 + (i % 5)));
		const curve = daily(260, (i) => (i === 259 ? -0.8 : 0.5 + (i % 3) * 0.1));
		const risk = computeRisk({ fred: { series: [series('vix', vix), series('t10y2y-us', curve)] } });
		expect(risk.parts.map((p) => p.id)).toEqual(['vix', 't10y2y']);
		expect(risk.parts.every((p) => p.z === -3)).toBe(true);
		expect(risk.score).toBe(-100);
		expect(riskLabel(risk.score)).toBe('Risk-off fuerte');
	});

	it('sin historial de bitcoin usa su variación a 7 días; la recesión de Polymarket, frente a un 25 %', () => {
		const risk = computeRisk({
			crypto: {
				coins: [
					{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd: 1, eur: 1, change24h: 0, change7d: 9, marketCap: 1 }
				]
			},
			predictions: {
				geopolitics: [],
				economy: [
					{
						id: '1',
						title: 'US recession in 2026?',
						url: '',
						volume24h: 1,
						endDate: '',
						outcomes: [
							{ label: 'No', p: 0.85 },
							{ label: 'Yes', p: 0.15 }
						]
					}
				]
			}
		});
		expect(risk.parts.map((p) => [p.id, p.z])).toEqual([
			['btc', 1],
			['recession', 1]
		]);
		expect(risk.score).toBe(40);
		expect(riskLabel(0)).toBe('Neutral');
	});

	it('sin datos, 0 y sin componentes', () => {
		expect(computeRisk({})).toEqual({ score: 0, parts: [] });
		expect(recessionOdds(null)).toBeNull();
	});
});
