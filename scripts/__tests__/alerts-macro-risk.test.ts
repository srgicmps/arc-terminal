// Avisos de riesgo macro (P2) con fred.json: diferencial high yield y liquidez neta de la Fed. Las series
// de ejemplo tienen la forma de Series (src/lib/types.ts): points del más antiguo al más reciente.
import { describe, expect, it } from 'vitest';
import {
	addDays,
	emptyLog,
	hyRule,
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

/** Commit del aviso sobre una copia del historial, como hace notify.ts al intentarlo. */
function committed(log: NotifyLog, alert: { commit?: (l: NotifyLog) => void }): NotifyLog {
	const next = structuredClone(log);
	alert.commit?.(next);
	return next;
}

const fred = (id: string, points: [string, number][]): Inputs => ({
	fred: {
		series: [{ id, name: id, unit: '', source: 'FRED', points: points.map(([t, v]) => ({ t, v })) }]
	} as unknown as Inputs['fred']
});

describe('Diferencial high yield', () => {
	const hy = (points: [string, number][]) => fred('hy-us', points);

	it('avisa si sube 50 pb o más en 7 días naturales', () => {
		const { alerts, ids } = run(
			hyRule,
			hy([
				['2026-10-05', 3.05],
				['2026-10-06', 3.1],
				['2026-10-09', 3.4],
				['2026-10-13', 3.72]
			])
		);
		expect(ids).toEqual(['hy:2026-10-13']);
		expect(alerts[0].title).toBe('Crédito: el diferencial high yield sube 62 pb en una semana (hasta 3,72 %)');
		expect(alerts[0].click).toMatch(/\/eco$/);
	});

	it('justo 50 pb cuenta; 49 no llega', () => {
		expect(run(hyRule, hy([['2026-10-06', 3.1], ['2026-10-13', 3.6]])).ids).toEqual(['hy:2026-10-13']);
		expect(run(hyRule, hy([['2026-10-06', 3.1], ['2026-10-13', 3.59]])).ids).toEqual([]);
	});

	it('con un festivo hace 7 días, compara con el último dato anterior', () => {
		// 2026-10-06 no hay dato: vale el del 5.
		const { alerts } = run(
			hyRule,
			hy([
				['2026-10-02', 2.5],
				['2026-10-05', 3.0],
				['2026-10-07', 3.4],
				['2026-10-13', 3.55]
			])
		);
		expect(alerts[0].title).toContain('sube 55 pb');
	});

	it('sin serie, sin fred.json o con menos de una semana de datos, no hace nada', () => {
		expect(run(hyRule, {}).ids).toEqual([]);
		expect(run(hyRule, fred('vix', [['2026-10-06', 15], ['2026-10-13', 30]])).ids).toEqual([]);
		expect(run(hyRule, hy([['2026-10-08', 3.0], ['2026-10-13', 4.0]])).ids).toEqual([]);
	});

	it('no repite mientras siga por encima; vuelve a avisar tras bajar del umbral o a los 7 días', () => {
		const first = run(hyRule, hy([['2026-10-06', 3.1], ['2026-10-13', 3.72]]));
		const log = committed(emptyLog(), first.alerts[0]);
		expect(log.last.hy).toBe('2026-10-13');

		// Al día siguiente sigue por encima: nada.
		expect(run(hyRule, hy([['2026-10-07', 3.1], ['2026-10-14', 3.8]]), log).ids).toEqual([]);

		// Baja del umbral: se borra la marca y el siguiente salto sí avisa.
		const calm = run(hyRule, hy([['2026-10-08', 3.6], ['2026-10-15', 3.7]]), log);
		expect(calm.ids).toEqual([]);
		expect(calm.after.last.hy).toBeUndefined();
		expect(run(hyRule, hy([['2026-10-09', 3.2], ['2026-10-16', 3.9]]), calm.after).ids).toEqual(['hy:2026-10-16']);

		// Sin bajar nunca, a los 7 días vuelve a avisar.
		expect(run(hyRule, hy([['2026-10-13', 3.72], ['2026-10-20', 4.3]]), log).ids).toEqual(['hy:2026-10-20']);
	});
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

it('las dos reglas están en RULES como P2', () => {
	for (const type of ['hy', 'liquidity']) expect(RULES.find((r) => r.type === type)?.level).toBe(2);
});
