import { describe, expect, it } from 'vitest';
import * as wm from './wm.ts';

const area = { w: 1600, h: 900 };
const app = (id: string, single?: boolean) => ({ id, size: { w: 880, h: 600 }, single });

describe('ventanas', () => {
	it('abre en cascada, a la rejilla de 8 px y al frente', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		const b = wm.openWin(s, app('geo'), area).win!;
		expect(b.x - a.x).toBe(32);
		expect(b.z).toBeGreaterThan(a.z);
		for (const n of [a.x, a.y, a.w, a.h, b.x, b.y]) expect(n % wm.GRID).toBe(0);
		expect(wm.focused(wm.activeDesk(s))?.uid).toBe(b.uid);
	});

	it('una app de una sola ventana se trae al frente en vez de abrir otra', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		wm.openWin(s, app('geo'), area);
		const again = wm.openWin(s, app('eco'), area);
		expect(again.win?.uid).toBe(a.uid);
		expect(wm.activeDesk(s).wins).toHaveLength(2);
		expect(wm.focused(wm.activeDesk(s))?.uid).toBe(a.uid);
		expect(wm.openWin(s, app('eco', false), area).win?.uid).not.toBe(a.uid);
	});

	it('no pasa del tope de ventanas', () => {
		const s = wm.emptyState();
		for (let i = 0; i < wm.MAX_WINS; i++) wm.openWin(s, app(`a${i}`), area);
		expect(wm.openWin(s, app('otra'), area)).toEqual({ win: null, reason: 'tope' });
	});

	it('minimizar quita el foco y enfocar la recupera', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		const b = wm.openWin(s, app('geo'), area).win!;
		wm.minimizeWin(s, b.uid);
		expect(wm.focused(wm.activeDesk(s))?.uid).toBe(a.uid);
		wm.focusWin(s, b.uid);
		expect(b.min).toBe(false);
		expect(wm.focused(wm.activeDesk(s))?.uid).toBe(b.uid);
	});

	it('encaja a mitades y cuartos, y vuelve a donde estaba', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		const before = { x: a.x, y: a.y, w: a.w, h: a.h };
		wm.snapWin(s, a.uid, 'left', area);
		expect([a.x, a.y, a.w, a.h]).toEqual([0, 0, 800, 900]);
		wm.snapWin(s, a.uid, 'bottom-right', area);
		expect([a.x, a.y, a.w, a.h]).toEqual([800, 450, 800, 450]);
		wm.snapWin(s, a.uid, 'bottom-right', area);
		expect({ x: a.x, y: a.y, w: a.w, h: a.h }).toEqual(before);
		wm.toggleMax(s, a.uid, area);
		expect(a.snap).toBe('max');
		wm.placeWin(s, a.uid, { x: 10, y: 10, w: 500, h: 400 }, area);
		expect(a.snap).toBeUndefined();
		expect([a.x, a.y, a.w, a.h]).toEqual([8, 8, 504, 400]);
	});

	it('no deja una ventana perdida fuera del escritorio', () => {
		const r = wm.fit({ x: 5000, y: -300, w: 100, h: 99999 }, area);
		expect(r.x).toBeLessThanOrEqual(area.w - wm.KEEP);
		expect(r.y).toBe(0);
		expect(r.w).toBe(wm.MIN_W);
		expect(r.h).toBe(area.h);
	});

	it('Alt+Tab pasa a la anterior por uso y vuelve', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('a'), area).win!;
		const b = wm.openWin(s, app('b'), area).win!;
		wm.openWin(s, app('c'), area);
		expect(wm.cycleWin(s)?.uid).toBe(b.uid);
		expect(wm.cycleWin(s, -1)?.uid).toBe(a.uid);
	});
});

describe('mosaico y teclado', () => {
	it('reparte las ventanas a la vista en una rejilla que llena el escritorio', () => {
		const s = wm.emptyState();
		for (const id of ['a', 'b', 'c']) wm.openWin(s, app(id), area);
		wm.minimizeWin(s, wm.activeDesk(s).wins[2].uid);
		wm.openWin(s, app('d'), area);
		wm.tileDesk(s, area);
		const r = (id: string) => {
			const w = wm.activeDesk(s).wins.find((x) => x.app === id)!;
			return [w.x, w.y, w.w, w.h];
		};
		expect(r('a')).toEqual([0, 0, 800, 450]);
		expect(r('b')).toEqual([800, 0, 800, 450]);
		expect(r('d')).toEqual([0, 450, 1600, 450]);
	});

	it('mueve y agranda un paso de la rejilla', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('a'), area).win!;
		const { x, w } = a;
		wm.nudgeWin(s, a.uid, 1, 0, false, area);
		expect(a.x).toBe(x + wm.GRID);
		wm.nudgeWin(s, a.uid, 1, 0, true, area);
		expect(a.w).toBe(w + wm.GRID);
	});
});

describe('como un sistema operativo', () => {
	it('«Nueva ventana» abre otra instancia de la misma app', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		const b = wm.openWin(s, app('eco'), area, undefined, true).win!;
		expect(b.uid).not.toBe(a.uid);
		expect(wm.activeDesk(s).wins.filter((w) => w.app === 'eco')).toHaveLength(2);
	});

	it('siempre encima se pinta delante aunque otra tenga el foco, y se guarda', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('a'), area).win!;
		const b = wm.openWin(s, app('b'), area).win!;
		wm.toggleTop(s, a.uid);
		expect(wm.focused(wm.activeDesk(s))?.uid).toBe(b.uid);
		expect(wm.stackZ(a)).toBeGreaterThan(wm.stackZ(b));
		expect(wm.reconcileOs(JSON.parse(JSON.stringify(s)), () => true).desks[0].wins[0].top).toBe(true);
		wm.toggleTop(s, a.uid);
		expect(a.top).toBeUndefined();
	});
});

describe('escritorios', () => {
	it('añade, renombra, cambia y quita sin perder ventanas', () => {
		const s = wm.emptyState();
		wm.openWin(s, app('eco'), area);
		const d2 = wm.addDesk(s, ' Mercados ')!;
		expect(s.active).toBe(d2.id);
		expect(d2.name).toBe('Mercados');
		wm.openWin(s, app('ws'), area);
		wm.renameDesk(s, d2.id, 'Bolsa');
		expect(d2.name).toBe('Bolsa');
		wm.removeDesk(s, d2.id);
		expect(s.desks).toHaveLength(1);
		expect(s.desks[0].wins.map((w) => w.app)).toEqual(['eco', 'ws']);
		wm.removeDesk(s, s.desks[0].id);
		expect(s.desks).toHaveLength(1);
	});

	it('pasa una ventana a otro escritorio', () => {
		const s = wm.emptyState();
		const a = wm.openWin(s, app('eco'), area).win!;
		const d2 = wm.addDesk(s)!;
		expect(wm.moveToDesk(s, a.uid, d2.id)).toBe(true);
		expect(s.desks[0].wins).toHaveLength(0);
		expect(d2.wins[0].app).toBe('eco');
	});
});

describe('lo guardado', () => {
	it('limpia lo que no vale', () => {
		const known = (id: string) => id !== 'vieja';
		expect(wm.reconcileOs('basura', known)).toEqual(wm.emptyState());
		const s = wm.reconcileOs(
			{
				desks: [
					{ id: 'd1', name: '', wins: [{ uid: 'w9', app: 'eco', x: 1, y: 2, w: 10, h: 10, z: 1, snap: 'nada', path: 'http://fuera' }, { uid: 'w9', app: 'geo' }, { uid: 'w3', app: 'vieja' }] },
					{ id: 'd1', name: 'repetido', wins: [] },
					{ id: 'd2', name: 'Bolsa', wins: [{ uid: 'w4', app: 'ws', snap: 'left', restore: { x: 0, y: 0, w: 500, h: 500 }, min: true }] }
				],
				active: 'd7'
			},
			known
		);
		expect(s.desks.map((d) => d.name)).toEqual(['Escritorio 1', 'Bolsa']);
		expect(s.active).toBe('d1');
		expect(s.desks[0].wins).toHaveLength(1);
		expect(s.desks[0].wins[0]).toMatchObject({ w: wm.MIN_W, h: wm.MIN_H });
		expect(s.desks[0].wins[0].snap).toBeUndefined();
		expect(s.desks[0].wins[0].path).toBeUndefined();
		expect(s.desks[1].wins[0]).toMatchObject({ snap: 'left', min: true });
		expect(s.seq).toBe(10);
	});
});
