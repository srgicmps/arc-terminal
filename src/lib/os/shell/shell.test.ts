import { describe, expect, it } from 'vitest';
import { buildNotices, markSeen, toastsFor, unread } from './notices.ts';
import { byCategory, categoryOf, parseIds, pushRecent, searchApps, togglePin } from './start.ts';
import { addWidget, defaultWidgets, nudge, stackWidgets, parseWidgets, removeWidget, snap, statusSummary } from './widgets.ts';
import { localZone, offsetFrom, openMarkets, timeIn } from './zones.ts';

const wall = {
	headlines: [],
	tape: [],
	alerts: [{ kind: 'terremoto' as const, title: 'Terremoto de magnitud 7', detail: 'Japón', time: '2026-10-15T10:00:00Z' }]
};
const changes = { items: [{ number: 471, title: 'Experiencias: galería', mergedAt: '2026-10-15T11:00:00Z', url: '' }] };

describe('notificaciones', () => {
	it('junta avisos y novedades, de la más nueva a la más vieja', () => {
		const list = buildNotices(wall, changes);
		expect(list.map((n) => n.kind)).toEqual(['novedad', 'aviso']);
		expect(list[1].href).toBe('/geo');
		expect(buildNotices(null, null)).toEqual([]);
	});
	it('recuerda lo leído sin repetir', () => {
		const list = buildNotices(wall, changes);
		const seen = markSeen(['x', 'n:471'], ['n:471']);
		expect(seen).toEqual(['x', 'n:471']);
		expect(unread(list, seen).map((n) => n.kind)).toEqual(['aviso']);
	});
	it('solo salta un aviso nuevo, y nunca la primera vez', () => {
		const list = buildNotices(wall, changes);
		expect(toastsFor(list, new Set(), true)).toEqual([]);
		expect(toastsFor(list, new Set(), false).map((n) => n.kind)).toEqual(['aviso']);
		expect(toastsFor(list, new Set(list.map((n) => n.id)), false)).toEqual([]);
	});
});

describe('menú Inicio', () => {
	const apps = [
		{ id: 'eco', title: 'Economía', code: 'ECO' },
		{ id: 'ws', title: 'Wall Street', code: 'WS', desc: 'Bolsa y divisas' },
		{ id: 'x:zen', title: 'Zen' },
		{ id: 'notas', title: 'Notas', category: 'Casa' },
		{ id: 'raro', title: 'Algo' }
	];
	it('reparte por categorías', () => {
		expect(apps.map(categoryOf)).toEqual(['Economía', 'Mercados', 'Experiencias', 'Casa', 'Herramientas']);
		expect(byCategory(apps).map((g) => g.category)).toEqual(['Mercados', 'Economía', 'Casa', 'Experiencias', 'Herramientas']);
	});
	it('busca sin tildes y pone delante el código exacto', () => {
		expect(searchApps(apps, 'economia').map((a) => a.id)).toEqual(['eco']);
		expect(searchApps(apps, 'divisas').map((a) => a.id)).toEqual(['ws']);
		expect(searchApps(apps, 'mercados').map((a) => a.id)).toEqual(['ws']);
		expect(searchApps(apps, '')).toEqual([]);
	});
	it('recientes y ancladas', () => {
		expect(pushRecent(['a', 'b', 'c'], 'c', 3)).toEqual(['c', 'a', 'b']);
		expect(togglePin(['a'], 'b')).toEqual(['a', 'b']);
		expect(togglePin(['a', 'b'], 'a')).toEqual(['b']);
		expect(parseIds('["a",1,"b"]')).toEqual(['a', 'b']);
		expect(parseIds('{')).toEqual([]);
	});
});

describe('widgets', () => {
	it('se ajustan a la rejilla y no se salen', () => {
		expect(snap({ kind: 'reloj', x: -50, y: 13 }, 1000, 600)).toEqual({ kind: 'reloj', x: 0, y: 16 });
		expect(snap({ kind: 'reloj', x: 5000, y: 5000 }, 1000, 600).x).toBe(760);
		expect(nudge({ kind: 'reloj', x: 0, y: 0 }, 'ArrowRight', true)).toEqual({ kind: 'reloj', x: 32, y: 0 });
	});
	it('añadir, quitar y leer lo guardado', () => {
		const d = defaultWidgets(1280);
		expect(addWidget(d, 'reloj', 1280)).toBe(d);
		expect(addWidget(d, 'luz', 1280).at(-1)?.kind).toBe('luz');
		expect(removeWidget(d, 'reloj').some((w) => w.kind === 'reloj')).toBe(false);
		expect(parseWidgets('[{"kind":"reloj","x":1,"y":2},{"kind":"reloj","x":3,"y":4},{"kind":"otro","x":0,"y":0}]')).toEqual([{ kind: 'reloj', x: 1, y: 2 }]);
		expect(parseWidgets('nada')).toBeNull();
		expect(defaultWidgets(1280, 'dsm').map((w) => w.kind)).toEqual(['sistema', 'registro', 'datos']);
	});
});

describe('reloj', () => {
	const now = Date.parse('2026-10-15T12:00:00Z');
	it('hora y diferencia', () => {
		expect(timeIn('Europe/Madrid', now)).toBe('14:00');
		expect(offsetFrom('America/New_York', 'Europe/Madrid', now)).toBe('−6');
		expect(offsetFrom('Asia/Kolkata', 'Europe/Madrid', now)).toBe('+3,5');
		expect(offsetFrom('Europe/Madrid', 'Europe/Madrid', now)).toBe('0');
	});
	it('sin zona de verdad en el navegador, la de Madrid', () => {
		expect(localZone('UTC')).toBe('Europe/Madrid');
		expect(localZone('Etc/GMT')).toBe('Europe/Madrid');
		expect(localZone('America/Bogota')).toBe('America/Bogota');
	});
	it('cuenta las bolsas abiertas', () => {
		// Jueves a las 14:00 de Madrid: abiertas Londres, Madrid y Fráncfort (Bombay cerró a las 12:00).
		expect(openMarkets(now)).toBe(3);
	});
});

import { isSkin, isSpotlightKey, layoutOf, magnify } from './skins.ts';

describe('estado de las fuentes', () => {
	it('cuenta por estado y da la última descarga', () => {
		const s = statusSummary([
			{ name: 'a', label: 'A', state: 'ok', fetchedAt: '2026-10-15T10:00:00Z' },
			{ name: 'b', label: 'B', state: 'stale', fetchedAt: '2026-10-15T11:00:00Z' },
			{ name: 'c', label: 'C', state: 'off', fetchedAt: null }
		]);
		expect(s).toEqual({ total: 3, ok: 1, stale: 1, error: 0, off: 1, last: '2026-10-15T11:00:00Z', failing: ['B'] });
	});
});

describe('aspectos', () => {
	it('colocan cada pieza en su sitio', () => {
		expect(layoutOf('windows', 'bottom')).toEqual({ top: null, bottom: 'taskbar' });
		expect(layoutOf('windows', 'top')).toEqual({ top: 'taskbar', bottom: null });
		expect(layoutOf('mac', 'top')).toEqual({ top: 'menubar', bottom: 'dock' });
		expect(layoutOf('linux', 'bottom')).toEqual({ top: 'topbar', bottom: null });
		expect(layoutOf('dsm', 'bottom')).toEqual({ top: 'dsmbar', bottom: null });
		expect(layoutOf('mando', 'bottom')).toEqual({ top: 'mandobar', bottom: 'mandostrip' });
		expect(isSkin('mac')).toBe(true);
		expect(isSkin('beos')).toBe(false);
	});
	it('la lupa del dock crece cerca y se queda en 1 lejos', () => {
		expect(magnify(0)).toBeCloseTo(1.6);
		expect(magnify(200)).toBe(1);
		expect(magnify(60)).toBeGreaterThan(1);
		expect(magnify(60)).toBeLessThan(1.6);
	});
	it('Ctrl+Espacio abre el buscador', () => {
		expect(isSpotlightKey({ code: 'Space', ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
		expect(isSpotlightKey({ code: 'Space', ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
	});
});

import { arrange, cellToPx, inRect, moveGroup, nearestFree, parseSpots, pxToCell, rectOf } from './icons.ts';

describe('iconos del escritorio', () => {
	const size = { w: 100, h: 100 };
	it('colocan los nuevos en la primera casilla libre, columna a columna', () => {
		expect(arrange(['a', 'b', 'c'], { b: { col: 0, row: 0 } }, 3, 2)).toEqual({ b: { col: 0, row: 0 }, a: { col: 0, row: 1 }, c: { col: 1, row: 0 } });
	});
	it('caen en la casilla libre más cercana', () => {
		const spots = { a: { col: 0, row: 0 }, b: { col: 1, row: 0 } };
		// «a» se está moviendo: su casilla cuenta como libre y es la más cercana.
		expect(nearestFree({ col: 1, row: 0 }, spots, ['a'], 3, 3)).toEqual({ col: 0, row: 0 });
		expect(nearestFree({ col: 1, row: 0 }, spots, [], 3, 3)).toEqual({ col: 1, row: 1 });
		expect(nearestFree({ col: 2, row: 2 }, spots, [], 3, 3)).toEqual({ col: 2, row: 2 });
	});
	it('se mueven en grupo sin pisarse', () => {
		const spots = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 }, c: { col: 1, row: 0 } };
		const out = moveGroup(spots, ['a', 'b'], { col: 0, row: 0 }, { col: 1, row: 0 }, 3, 3);
		expect(out.c).toEqual({ col: 1, row: 0 });
		expect(out.b).toEqual({ col: 1, row: 1 });
		expect(out.a).not.toEqual(out.c);
	});
	it('px ↔ casilla y selección rectangular', () => {
		expect(pxToCell(220, 115, size, 5, 5)).toEqual({ col: 2, row: 1 });
		expect(pxToCell(9999, -50, size, 5, 5)).toEqual({ col: 4, row: 0 });
		expect(cellToPx({ col: 1, row: 1 }, size)).toEqual({ x: 112, y: 112 });
		const spots = { a: { col: 0, row: 0 }, b: { col: 1, row: 1 }, c: { col: 3, row: 3 } };
		expect(inRect(rectOf({ x: 150, y: 150 }, { x: 0, y: 0 }), spots, size).sort()).toEqual(['a', 'b']);
	});
	it('lo guardado se valida', () => {
		expect(parseSpots('{"a":{"col":1,"row":2},"b":{"col":-1,"row":0},"c":"x"}')).toEqual({ a: { col: 1, row: 2 } });
		expect(parseSpots('nada')).toEqual({});
	});
});

describe('stackWidgets', () => {
	const list = defaultWidgets(1280, 'mando');
	it('apila según el alto real, con el mismo hueco y en la rejilla', () => {
		expect(stackWidgets(list, [100, 50, 203]).map((w) => w.y)).toEqual([16, 136, 208]);
	});
	it('sin medir aún, se quedan donde estaban', () => {
		expect(stackWidgets(list, [])).toBe(list);
		expect(stackWidgets(list, [100, 0, 80])).toBe(list);
	});
});
