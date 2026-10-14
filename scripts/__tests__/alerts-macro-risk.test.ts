// Aviso de riesgo macro (P2) con fred.json: liquidez neta de la Fed. Las series
// de ejemplo tienen la forma de Series (src/lib/types.ts): points del más antiguo al más reciente.
import { describe, expect, it } from 'vitest';
import {
	addDays,
	emptyLog,
	liquidityRule,
	madrid,
	RULES,
	type Inputs,
	type NotifyLog,
	type Rule,
	type RuleContext
} from '../alerts/rules.ts';

const NOW = Date.parse('2026-10-14T10:00:00Z');

function run(rule: Rule['run'], d: Inputs, log: NotifyLog = emptyLog()) {
	const updates: ((l: NotifyLog) => void)[] = [];
	const ctx: RuleContext = { now: NOW, today: madrid(NOW).date, log, update: (fn) => void updates.push(fn) };
	const alerts = rule(d, ctx);
	const after = structuredClone(log);
	for (const fn of updates) fn(after);
	return { alerts, ids: alerts.map((a) => a.id), after };
}

const fred = (id: string, points: [string, number][]): Inputs => ({
	fred: {
		series: [{ id, name: id, unit: '', source: 'FRED', points: points.map(([t, v]) => ({ t, v })) }]
	} as unknown as Inputs['fred']
});

describe('Liquidez neta de la Fed', () => {
	const liq = (values: number[]) =>
		fred(
			'fed-net-liquidity',
			values.map((v, i) => [addDays('2026-10-14', 7 * (i - values.length + 1)), v] as [string, number])
		);

	it('avisa si cae 100 000 M$ o más en 4 semanas, con números en español', () => {
		const { alerts, ids } = run(liquidityRule, liq([6_000_000, 5_952_000, 5_900_000, 5_870_000, 5_810_000]));
		expect(ids).toEqual(['liquidity:2026-10-14']);
		expect(alerts[0].title).toBe('Liquidez de la Fed: −190.000 M$ en 4 semanas (5,81 billones)');
		expect(alerts[0].click).toMatch(/\/eco$/);
	});

	it('compara con 4 datos antes (points.at(-5)), no con el primero', () => {
		const { alerts } = run(liquidityRule, liq([9_000_000, 5_952_000, 5_900_000, 5_870_000, 5_850_000, 5_810_000]));
		expect(alerts[0].title).toContain('−142.000 M$');
	});

	it('no avisa si no llega al umbral o si sube', () => {
		expect(run(liquidityRule, liq([5_900_000, 5_880_000, 5_860_000, 5_840_000, 5_800_001])).ids).toEqual([]);
		expect(run(liquidityRule, liq([5_800_000, 5_850_000, 5_900_000, 5_950_000, 6_000_000])).ids).toEqual([]);
	});

	it('sin serie o con menos de 5 datos, no hace nada', () => {
		expect(run(liquidityRule, {}).ids).toEqual([]);
		expect(run(liquidityRule, liq([6_000_000, 5_800_000, 5_700_000, 5_600_000])).ids).toEqual([]);
	});

	it('un aviso por dato semanal: el id lleva la fecha del último dato', () => {
		const pts: [string, number][] = [
			['2026-09-09', 6_000_000],
			['2026-09-16', 5_952_000],
			['2026-09-23', 5_900_000],
			['2026-09-30', 5_870_000],
			['2026-10-07', 5_810_000]
		];
		const a = run(liquidityRule, fred('fed-net-liquidity', pts));
		const b = run(liquidityRule, fred('fed-net-liquidity', [...pts, ['2026-10-14', 5_700_000]]));
		expect(a.ids).toEqual(['liquidity:2026-10-07']);
		expect(b.ids).toEqual(['liquidity:2026-10-14']);
	});
});

it('la regla está en RULES como P2', () => {
	expect(RULES.find((r) => r.type === 'liquidity')?.level).toBe(2);
});
