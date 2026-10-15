import { describe, expect, it } from 'vitest';
import { applyPlan, buildPlan, INTERESTS, needsWelcome, PROFILES, readWelcome, WELCOME_KEY } from './plan.ts';
import { PINS } from '../pins.ts';
import { isDocumented } from '../prefs.ts';
import { GROUPS } from '../alertconfig.ts';
import { isHomeCode } from '../home.ts';
import { TOP_MODULES } from '../topmodules.ts';

const MODULES = TOP_MODULES.map((m) => m.id);

function memory(init: Record<string, string> = {}) {
	const m = new Map(Object.entries(init));
	return {
		map: m,
		get length() {
			return m.size;
		},
		key: (i: number) => [...m.keys()][i] ?? null,
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v)
	};
}

describe('bienvenida', () => {
	it('perfiles e intereses apuntan a cosas que existen', () => {
		const pinIds = PINS.map((p) => p.id);
		const groups = GROUPS.map((g) => g.id as string);
		for (const i of INTERESTS) {
			for (const id of i.top) expect(MODULES, `${i.id}: ${id}`).toContain(id);
			for (const id of i.pins) expect(pinIds).toContain(id);
			for (const g of i.alerts) expect(groups).toContain(g);
		}
		for (const p of PROFILES) expect(p.home === 'TOP' || isHomeCode(p.home), p.id).toBe(true);
	});

	it('el plan pone lo tuyo delante y oculta el resto', () => {
		const plan = buildPlan(['hogar'], null, MODULES, true);
		expect(plan.layout.order.slice(0, 4)).toEqual(['important', 'weather', 'power', 'fuel']);
		expect(plan.layout.hidden).toContain('hn');
		expect(plan.layout.hidden).not.toContain('power');
		expect(plan.layout.order).toHaveLength(MODULES.length);
		expect(plan.alerts.groups).toEqual(['energia', 'resumenes']);
	});

	it('«Todo» no oculta nada y los avisos solo llevan valores de EE. UU.', () => {
		const plan = buildPlan([], 'todo', MODULES, false);
		expect(plan.layout.hidden).toEqual([]);
		expect(plan.alerts.mis).not.toContain('SAN');
		expect(plan.alerts.mis).toContain('NVDA');
	});

	it('aplicar respeta tu lista de valores y suma los fijados', () => {
		const store = memory({
			'arc-watchlists': JSON.stringify({ active: 0, lists: [{ name: 'Mi lista', codes: ['TSLA'] }] }),
			'arc-pins': JSON.stringify([{ id: 'pin:geo:mapa', span: 2 }])
		});
		applyPlan(store, buildPlan([], 'inversor', MODULES, false));
		expect(JSON.parse(store.getItem('arc-watchlists')!).lists[0].codes).toEqual(['TSLA']);
		expect(JSON.parse(store.getItem('arc-pins')!)).toEqual([
			{ id: 'pin:geo:mapa', span: 2 },
			{ id: 'pin:eco:bancos', span: 1 }
		]);
		expect(store.getItem('arc-mode')).toBe('modular');
		expect(store.getItem('arc-simple')).toBe('0');
		expect(readWelcome(store.getItem(WELCOME_KEY))?.profile).toBe('inversor');
	});

	it('con la lista vacía, la de ejemplo', () => {
		const store = memory();
		applyPlan(store, buildPlan([], 'curioso', MODULES, true));
		expect(JSON.parse(store.getItem('arc-watchlists')!).lists[0].codes).toEqual(['SPY', 'AAPL', 'NVDA']);
		expect(store.getItem('arc-home')).toBe('IMP');
	});

	it('sale sola solo a quien llega por primera vez', () => {
		expect(needsWelcome(memory(), '')).toBe(true);
		expect(needsWelcome(memory(), '?lugar=1,2,X')).toBe(false);
		expect(needsWelcome(memory({ 'arc-theme': 'dark' }), '')).toBe(false);
		expect(needsWelcome(memory({ 'arc-sync': '{}' }), '')).toBe(true);
		expect(needsWelcome(memory({ [WELCOME_KEY]: '{}' }), '')).toBe(false);
	});

	it('las claves que escribe están en el registro de prefs', () => {
		const store = memory();
		applyPlan(store, buildPlan(['bolsa'], null, MODULES, false));
		for (const k of store.map.keys()) expect(isDocumented(k), k).toBe(true);
	});

	it('lo roto no cuenta como hecho', () => {
		expect(readWelcome('nope')).toBeNull();
		expect(readWelcome('{"v":2}')).toBeNull();
	});
});
