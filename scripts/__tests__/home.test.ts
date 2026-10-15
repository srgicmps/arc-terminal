import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/lib/alertconfig.ts';
import { fuelHomeRule, homeRules, luzHomeRule, pollenHomeRule, resultsEveRule } from '../alerts/home.ts';
import { parseHomeFuel } from '../../src/lib/alertconfig.ts';
import type { NotifyLog } from '../alerts/rules.ts';
import { briefLines } from '../alerts/brief.ts';
import { emptyLog, type Inputs, type RuleContext } from '../alerts/rules.ts';

const at = (hm: string) => Date.parse(`2026-10-15T${hm}:00+02:00`);
const ctx = (hm: string): RuleContext => ({ now: at(hm), today: '2026-10-15', log: emptyLog(), update: () => {} });

/** PVPC de un día: barato de 3 a 5 y de 14 a 16. */
const pvpc = (day: string) =>
	Array.from({ length: 24 }, (_, h) => ({
		t: `${day}T${String(h).padStart(2, '0')}:00:00.000+02:00`,
		v: h >= 3 && h < 5 ? 40 : h >= 14 && h < 16 ? 50 : 150
	}));

describe('avisos de casa (F16)', () => {
	const d = { power: { pvpc: [...pvpc('2026-10-15'), ...pvpc('2026-10-16')], spot: [] } } as unknown as Inputs;

	it('luz: las franjas baratas de mañana, solo desde que se publican', () => {
		expect(luzHomeRule(d, ctx('19:00'))).toEqual([]);
		const [a] = luzHomeRule(d, ctx('21:00'));
		expect(a.id).toBe('casa:luz:2026-10-16');
		expect(a.body.split('\n')[0]).toBe('03:00–05:00 · 0,040 €/kWh');
		expect(a.body).toContain('14:00–16:00');
		expect(luzHomeRule({} as Inputs, ctx('21:00'))).toEqual([]);
	});

	it('polen: solo si mañana llega a moderado o alto', () => {
		const day = { date: '2026-10-16', aqi: null, uv: null, pollen: { olive: 250, grass: 2 } };
		const [a] = pollenHomeRule('Madrid', day)({} as Inputs, ctx('20:00'));
		expect(a.title).toBe('Polen mañana en Madrid');
		expect(a.body).toContain('Olivo: alto');
		expect(a.body).not.toContain('Gramíneas');
		expect(pollenHomeRule('Madrid', { ...day, pollen: { olive: 3 } })({} as Inputs, ctx('20:00'))).toEqual([]);
		expect(pollenHomeRule('Madrid', { ...day, date: '2026-10-15' })({} as Inputs, ctx('20:00'))).toEqual([]);
	});

	it('resultados: la víspera, solo de sus valores', () => {
		const e = { finnhub: { earnings: [{ symbol: 'NVDA', date: '2026-10-16', hour: 'amc' }, { symbol: 'MSFT', date: '2026-10-16', hour: 'bmo' }] } } as unknown as Inputs;
		const [a] = resultsEveRule(['NVDA'])(e, ctx('18:30'));
		expect(a).toMatchObject({ id: 'casa:resultados:2026-10-16', title: 'Mañana presenta resultados NVDA', body: 'NVDA (al cierre).' });
		expect(resultsEveRule(['NVDA'])(e, ctx('12:00'))).toEqual([]);
	});

	it('solo las que ha encendido; el polen necesita su sitio', () => {
		expect(homeRules(parseConfig({ home: { luz: true, pollen: true } }))).toHaveLength(1);
		const place = { name: 'Madrid', lat: 40.4, lon: -3.7 };
		expect(homeRules(parseConfig({ home: { luz: true, pollen: true, results: true }, brief: { place } }))).toHaveLength(3);
		expect(homeRules(parseConfig({}))).toEqual([]);
	});

	it('«Tu mañana» (F13): la luz que queda hoy y los mercados, sin dejar sin titulares', () => {
		const c = parseConfig({ on: true, groups: ['mercados'], home: { luz: true } });
		const imp = { current: [{ title: 'Uno', sections: [] }, { title: 'Dos', sections: [] }, { title: 'Tres', sections: [] }] };
		const lines = briefLines(c, { ...d, imp } as unknown as Inputs, '2026-10-15', new Set(), null, at('08:00'));
		expect(lines[0]).toBe('Luz más barata hoy: de 14:00 a 16:00 (0,050 €/kWh).');
		expect(lines.filter((l) => /^(Uno|Dos|Tres)/.test(l)).length).toBeGreaterThanOrEqual(2);
	});
});

describe('gasolinera favorita (F16)', () => {
	const fav = parseHomeFuel({ zone: '07', id: '1234', name: 'Repsol Maó', town: 'Maó', log: [] })!;
	const st = (g95: number) => ({ id: '1234', prices: { g95, diesel: null, g98: null, glp: null } }) as never;
	const pass = (log: NotifyLog, price: number, hm = '10:00') => {
		const updates: ((l: NotifyLog) => void)[] = [];
		const out = fuelHomeRule(fav, st(price))({} as Inputs, { ...ctx(hm), log, update: (f) => void updates.push(f) });
		for (const f of updates) f(log);
		for (const a of out) {
			a.commit?.(log);
			log.entries.push({ k: a.id, t: '', s: 'sent' });
		}
		return out;
	};

	it('la primera vez solo apunta; avisa si baja 2 céntimos desde su máximo, una vez al día', () => {
		const log = emptyLog();
		expect(pass(log, 1.5)).toEqual([]);
		expect(pass(log, 1.52)).toEqual([]);
		expect(pass(log, 1.51)).toEqual([]);
		const [a] = pass(log, 1.499);
		expect(a.title).toBe('Repsol Maó: Gasolina 95 a 1,499 €/L');
		expect(a.body).toContain('2,1 céntimos');
		expect(pass(log, 1.45)).toEqual([]);
	});

	it('sin estación o sin ese combustible, nada; zonas o ids raros no se aceptan', () => {
		expect(fuelHomeRule(fav, null)({} as Inputs, ctx('10:00'))).toEqual([]);
		expect(parseHomeFuel({ zone: '../x', id: '1' })).toBeNull();
		expect(parseHomeFuel({ zone: 'menorca', id: '1/2' })).toBeNull();
		expect(parseHomeFuel({ zone: 'menorca', id: '12', kind: 'diesel' })).toMatchObject({ kind: 'diesel', name: 'Tu gasolinera' });
	});
});
