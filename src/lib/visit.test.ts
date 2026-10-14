import { describe, expect, it } from 'vitest';
import { isNew, KEY, newCount, newSinceText, readStamp, SESSION_KEY, startingPoint, storage, writeStamp, type Store } from './visit.ts';

/** Almacén en memoria, como localStorage. */
function memory(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
	const data = { ...init };
	return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
/** Un localStorage que lanza en todo (modo privado, cookies bloqueadas, cuota llena…). */
const broken: Store = {
	getItem: () => {
		throw new Error('SecurityError');
	},
	setItem: () => {
		throw new Error('QuotaExceededError');
	}
};

const item = (time: string | null) => ({ time });

describe('isNew / newCount', () => {
	const last = '2026-10-14T07:12:00Z';

	it('solo cuenta lo posterior a la última visita', () => {
		expect(isNew(item('2026-10-14T07:12:01Z'), last)).toBe(true);
		expect(isNew(item('2026-10-14T07:12:00Z'), last)).toBe(false);
		expect(isNew(item('2026-10-14T06:00:00Z'), last)).toBe(false);
	});

	it('compara instantes, no textos: vale con otras zonas horarias', () => {
		expect(isNew(item('2026-10-14T09:30:00+02:00'), last)).toBe(true); // 07:30Z
		expect(isNew(item('2026-10-14T09:00:00+02:00'), last)).toBe(false); // 07:00Z
	});

	it('sin visita anterior, sin fecha o con fechas rotas, nada es nuevo', () => {
		expect(isNew(item('2026-10-14T08:00:00Z'), null)).toBe(false);
		expect(isNew(item(null), last)).toBe(false);
		expect(isNew(item('ayer'), last)).toBe(false);
		expect(isNew(item('2026-10-14T08:00:00Z'), 'basura')).toBe(false);
	});

	it('cuenta los nuevos', () => {
		const items = ['2026-10-14T08:00:00Z', '2026-10-14T07:00:00Z', null, '2026-10-14T07:13:00Z'].map(item);
		expect(newCount(items, last)).toBe(2);
		expect(newCount(items, null)).toBe(0);
		expect(newCount([], last)).toBe(0);
	});

	it('funciona a los dos lados del cambio de hora (25 oct 2026, 03:00 CEST → 02:00 CET)', () => {
		// Última visita: 02:30 CEST (00:30Z), antes del cambio. Titular: 02:10 CET (01:10Z), después.
		// En hora local parece anterior (02:10 < 02:30), pero es 40 min posterior.
		const before = '2026-10-25T00:30:00Z';
		expect(isNew(item('2026-10-25T02:10:00+01:00'), before)).toBe(true);
		expect(isNew(item('2026-10-25T02:20:00+02:00'), before)).toBe(false);
		expect(newCount([item('2026-10-25T02:10:00+01:00'), item('2026-10-25T02:20:00+02:00')], before)).toBe(1);
	});
});

describe('newSinceText', () => {
	const now = Date.parse('2026-10-14T15:00:00Z');

	it('«18 titulares nuevos desde las 9:12», en hora de Madrid', () => {
		expect(newSinceText(18, '2026-10-14T07:12:00Z', now)).toBe('18 titulares nuevos desde las 9:12');
		expect(newSinceText(1, '2026-10-14T07:12:00Z', now)).toBe('1 titular nuevo desde las 9:12');
		expect(newSinceText(0, '2026-10-14T07:12:00Z', now)).toBe('Nada nuevo desde las 9:12');
	});

	it('ayer u otro día', () => {
		expect(newSinceText(5, '2026-10-13T19:40:00Z', now)).toBe('5 titulares nuevos desde ayer a las 21:40');
		expect(newSinceText(5, '2026-10-12T19:40:00Z', now)).toBe('5 titulares nuevos desde el 12 oct a las 21:40');
	});

	it('el día lo decide Madrid, no UTC', () => {
		// 22:30Z del 13 es ya las 0:30 del 14 en Madrid: «hoy».
		expect(newSinceText(2, '2026-10-13T22:30:00Z', now)).toBe('2 titulares nuevos desde las 0:30');
	});

	it('a los dos lados del cambio de hora', () => {
		// Otoño. Después (CET, +1): 26 oct 08:12Z → 9:12. Antes (CEST, +2): 24 oct 07:12Z → 9:12.
		const autumn = Date.parse('2026-10-26T12:00:00Z');
		expect(newSinceText(3, '2026-10-26T08:12:00Z', autumn)).toBe('3 titulares nuevos desde las 9:12');
		expect(newSinceText(3, '2026-10-25T20:00:00Z', autumn)).toBe('3 titulares nuevos desde ayer a las 21:00');
		expect(newSinceText(3, '2026-10-24T07:12:00Z', autumn)).toBe('3 titulares nuevos desde el 24 oct a las 9:12');
		// El mismo día del cambio: 00:30Z es 2:30 CEST; 02:30Z es 3:30 CET.
		const changeDay = Date.parse('2026-10-25T10:00:00Z');
		expect(newSinceText(1, '2026-10-25T00:30:00Z', changeDay)).toBe('1 titular nuevo desde las 2:30');
		expect(newSinceText(1, '2026-10-25T02:30:00Z', changeDay)).toBe('1 titular nuevo desde las 3:30');
		// Primavera: 29 mar 2026, 02:00 CET → 03:00 CEST.
		const spring = Date.parse('2026-03-29T10:00:00Z');
		expect(newSinceText(4, '2026-03-29T00:30:00Z', spring)).toBe('4 titulares nuevos desde las 1:30');
		expect(newSinceText(4, '2026-03-29T01:30:00Z', spring)).toBe('4 titulares nuevos desde las 3:30');
		expect(newSinceText(4, '2026-03-28T22:00:00Z', spring)).toBe('4 titulares nuevos desde ayer a las 23:00');
	});

	it('sin visita anterior, nada que decir', () => {
		expect(newSinceText(18, null, now)).toBe('');
		expect(newSinceText(18, 'basura', now)).toBe('');
	});
});

describe('lectura y escritura seguras', () => {
	it('lee y escribe la marca', () => {
		const ls = memory();
		expect(readStamp(ls)).toBeNull();
		expect(writeStamp(ls, '2026-10-14T07:12:00.000Z')).toBe(true);
		expect(ls.data[KEY]).toBe('2026-10-14T07:12:00.000Z');
		expect(readStamp(ls)).toBe('2026-10-14T07:12:00.000Z');
	});

	it('ignora valores rotos', () => {
		expect(readStamp(memory({ [KEY]: 'no es una fecha' }))).toBeNull();
		expect(readStamp(memory({ [KEY]: '' }))).toBeNull();
	});

	it('no revienta si el almacén lanza o no existe', () => {
		expect(readStamp(broken)).toBeNull();
		expect(writeStamp(broken, '2026-10-14T07:12:00Z')).toBe(false);
		expect(readStamp(null)).toBeNull();
		expect(writeStamp(null, '2026-10-14T07:12:00Z')).toBe(false);
		expect(startingPoint(broken, broken)).toBeNull();
	});

	it('storage() da null si no hay localStorage (prerender) o si acceder lanza', () => {
		const g = globalThis as Record<string, unknown>;
		expect(storage('localStorage')).toBeNull(); // Node, sin DOM
		Object.defineProperty(g, 'localStorage', {
			configurable: true,
			get() {
				throw new Error('SecurityError');
			}
		});
		try {
			expect(storage('localStorage')).toBeNull();
		} finally {
			delete g.localStorage;
		}
	});

	it('primera visita: null, y recargar la pestaña sigue siendo primera visita', () => {
		const ls = memory();
		const ss = memory();
		expect(startingPoint(ls, ss)).toBeNull();
		expect(ss.data[SESSION_KEY]).toBe('none');
		ls.data[KEY] = '2026-10-14T10:00:00.000Z'; // pagehide al recargar
		expect(startingPoint(ls, ss)).toBeNull();
	});

	it('visita siguiente: la marca guardada, que se mantiene al recargar', () => {
		const ls = memory({ [KEY]: '2026-10-14T07:12:00.000Z' });
		const ss = memory();
		expect(startingPoint(ls, ss)).toBe('2026-10-14T07:12:00.000Z');
		ls.data[KEY] = '2026-10-14T10:00:00.000Z';
		expect(startingPoint(ls, ss)).toBe('2026-10-14T07:12:00.000Z');
		// Pestaña nueva (sessionStorage vacío): ya cuenta la marca nueva.
		expect(startingPoint(ls, memory())).toBe('2026-10-14T10:00:00.000Z');
	});

	it('si sessionStorage lanza, usa localStorage', () => {
		expect(startingPoint(memory({ [KEY]: '2026-10-14T07:12:00.000Z' }), broken)).toBe('2026-10-14T07:12:00.000Z');
	});
});
