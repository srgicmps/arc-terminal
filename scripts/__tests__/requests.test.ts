import { describe, expect, it } from 'vitest';
import { emptyLog, type NotifyLog, type RuleContext } from '../alerts/rules.ts';
import { userAlertRule, watchRule, type UserInputs } from '../alerts/user.ts';
import { emptyRequests, planRequests, type RawIssue } from '../requests.ts';
import { parseAlert } from '../../src/lib/useralerts.ts';

const mine = (number: number, title: string): RawIssue => ({ number, title, user: { login: 'srgicmps' }, author_association: 'OWNER' });

describe('planRequests', () => {
	it('ignora los issues de otras personas y los PR', () => {
		const r = planRequests([
			{ number: 1, title: '[alerta] NVDA > 1', user: { login: 'otro' }, author_association: 'NONE' },
			{ number: 2, title: '[mis] HACK', user: { login: 'srgicmps' }, author_association: 'CONTRIBUTOR' },
			{ ...mine(3, '[alerta] NVDA > 1'), pull_request: {} }
		]);
		expect(r).toEqual(emptyRequests());
	});
	it('MIS y vigila: vale el más reciente; los anteriores se cierran', () => {
		const r = planRequests([mine(5, '[mis] NVDA AAPL'), mine(9, '[mis] MSFT'), mine(7, '[vigila] aranceles, vivienda')]);
		expect(r.mis).toEqual(['MSFT']);
		expect(r.words).toEqual(['aranceles', 'vivienda']);
		expect(r.close.map((c) => c.issue)).toEqual([5]);
	});
	it('alertas: las válidas, de la más antigua a la más nueva; las que no se entienden se cierran', () => {
		const r = planRequests([mine(4, '[alerta] BTC -5%'), mine(2, '[alerta] NVDA > 150'), mine(3, '[alerta] no sé')]);
		expect(r.alerts.map((a) => a.issue)).toEqual([2, 4]);
		expect(r.close.map((c) => c.issue)).toEqual([3]);
	});
	it('tope de alertas', () => {
		const many = Array.from({ length: 22 }, (_, i) => mine(i + 1, '[alerta] NVDA > 150'));
		const r = planRequests(many);
		expect(r.alerts).toHaveLength(20);
		expect(r.close.map((c) => c.issue)).toEqual([21, 22]);
	});
});

const now = Date.parse('2026-10-15T10:00:00Z');
const ctx = (log: NotifyLog = emptyLog(), updates: ((l: NotifyLog) => void)[] = []): RuleContext => ({
	now,
	today: '2026-10-15',
	log,
	update: (fn) => void updates.push(fn)
});

describe('alertas propias', () => {
	const req = (title: string) => ({ ...emptyRequests(), alerts: [{ issue: 12, alert: parseAlert(title)! }] });
	it('valor por encima del nivel', () => {
		const d = { alertQuotes: [{ symbol: 'NVDA', price: 151.2, changePct: 2 }] } as UserInputs;
		const [a] = userAlertRule(req('NVDA > 150')).run(d, ctx());
		expect(a).toMatchObject({ id: 'user-alert:12', title: 'Alerta: NVDA > 150' });
		expect(userAlertRule(req('NVDA > 160')).run(d, ctx())).toEqual([]);
	});
	it('bitcoin baja un 5 %', () => {
		const d = { crypto: { coins: [{ id: 'bitcoin', usd: 60000, change24h: -6 }] } } as unknown as UserInputs;
		expect(userAlertRule(req('BTC -5%')).run(d, ctx())).toHaveLength(1);
	});
	it('diésel, con la media de España', () => {
		const d = { fuelEs: { history: [{ date: '2026-10-14', avg: { diesel: 1.38 } }] } } as unknown as UserInputs;
		const [a] = userAlertRule(req('diésel < 1,40')).run(d, ctx());
		expect(a.body).toContain('1,380 €/L');
	});
	it('sin datos, nada', () => {
		expect(userAlertRule(req('NVDA > 150')).run({} as UserInputs, ctx())).toEqual([]);
	});
});

describe('palabras vigiladas', () => {
	const search = [
		{ t: 'Trump anuncia nuevos aranceles', u: 'https://a/1', s: 'NEWS' },
		{ t: 'Real Decreto sobre vivienda', u: 'https://b/2', s: 'BOE' },
		{ t: 'Aranceles: NVDA', u: '/s?sym=NVDA', s: 'Valor' }
	] as UserInputs['search'];
	it('una palabra nueva no avisa de lo que ya había; lo siguiente sí', () => {
		const req = { ...emptyRequests(), words: ['aranceles'] };
		const log = emptyLog();
		const updates: ((l: NotifyLog) => void)[] = [];
		expect(watchRule(req).run({ search } as UserInputs, ctx(log, updates))).toEqual([]);
		for (const fn of updates) fn(log);
		const more = [...search!, { t: 'La UE responde a los aranceles', u: 'https://a/3', s: 'NEWS' as const }];
		const [a] = watchRule(req).run({ search: more } as UserInputs, ctx(log));
		expect(a.title).toBe('Palabra vigilada');
		expect(a.body).toContain('La UE responde');
		expect(a.click).toBe('https://a/3');
	});
	it('sin palabras, nada', () => {
		expect(watchRule(emptyRequests()).run({ search } as UserInputs, ctx())).toEqual([]);
	});
});
