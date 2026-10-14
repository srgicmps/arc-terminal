import { describe, expect, it } from 'vitest';
import { financialStress, STRESS_RULES, stressReading } from './stress.ts';
import type { Series } from './types.ts';

const s = (id: string, points: [string, number][]): Series => ({ id, label: id, unit: 'pts', source: 'x', points: points.map(([t, v]) => ({ t, v })) });
const [ciss, stlfsi] = STRESS_RULES;

describe('stressReading', () => {
	it('da el último dato, su fecha y si está en zona alta', () => {
		const r = stressReading(ciss, s('ciss-ea', [['2026-10-10', 0.5], ['2026-10-13', 0.0115]]))!;
		expect(r).toMatchObject({ last: 0.0115, date: '2026-10-13', high: false, rule: '≥ 0,40' });
	});

	it('CISS: alto desde 0,40 (incluido)', () => {
		expect(stressReading(ciss, s('ciss-ea', [['2026-10-13', 0.4]]))!.high).toBe(true);
		expect(stressReading(ciss, s('ciss-ea', [['2026-10-13', 0.399]]))!.high).toBe(false);
	});

	it('STLFSI: alto solo por encima de 1', () => {
		expect(stressReading(stlfsi, s('stlfsi-us', [['2026-10-09', 1]]))!.high).toBe(false);
		expect(stressReading(stlfsi, s('stlfsi-us', [['2026-10-09', 1.01]]))!.high).toBe(true);
		expect(stressReading(stlfsi, s('stlfsi-us', [['2026-10-09', -0.6]]))!.high).toBe(false);
	});

	it('sin serie o sin puntos, null', () => {
		expect(stressReading(ciss, undefined)).toBeNull();
		expect(stressReading(ciss, null)).toBeNull();
		expect(stressReading(ciss, s('ciss-ea', []))).toBeNull();
	});
});

describe('financialStress', () => {
	it('solo los índices que hay, en orden', () => {
		const map = new Map([['stlfsi-us', s('stlfsi-us', [['2026-10-09', 2]])]]);
		const out = financialStress((id) => map.get(id));
		expect(out.map((r) => [r.id, r.high])).toEqual([['stlfsi-us', true]]);
		expect(financialStress(() => undefined)).toEqual([]);
	});
});
