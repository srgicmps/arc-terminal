import { describe, expect, it } from 'vitest';
import { buildNotices, markSeen, toastsFor, unread } from './notices.ts';
import { byCategory, categoryOf, parseIds, pushRecent, searchApps, togglePin } from './start.ts';
import { addWidget, defaultWidgets, nudge, parseWidgets, removeWidget, snap } from './widgets.ts';
import { offsetFrom, openMarkets, timeIn } from './zones.ts';

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
	it('cuenta las bolsas abiertas', () => {
		// Jueves a las 14:00 de Madrid: abiertas Londres, Madrid y Fráncfort (Bombay cerró a las 12:00).
		expect(openMarkets(now)).toBe(3);
	});
});

import { isSkin, isSpotlightKey, layoutOf, magnify } from './skins.ts';

describe('aspectos', () => {
	it('colocan cada pieza en su sitio', () => {
		expect(layoutOf('windows', 'bottom')).toEqual({ top: null, bottom: 'taskbar' });
		expect(layoutOf('windows', 'top')).toEqual({ top: 'taskbar', bottom: null });
		expect(layoutOf('mac', 'top')).toEqual({ top: 'menubar', bottom: 'dock' });
		expect(layoutOf('linux', 'bottom')).toEqual({ top: 'topbar', bottom: null });
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
