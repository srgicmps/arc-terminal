import { describe, expect, it } from 'vitest';
import type { ImpCurrent, Quake, Quote } from '../types.ts';
import { alertShowing, buildWall, rotation } from './muro.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const imp = (over: Partial<ImpCurrent>): ImpCurrent =>
	({ k: 'k', title: 'Title', url: '', sources: ['a'], score: 1, sections: ['eco'], first: ago(1), time: null, ...over }) as ImpCurrent;
const quake = (over: Partial<Quake>): Quake =>
	({ id: 'q', mag: 7, place: 'Japón', time: ago(1), url: '', tsunami: false, alert: null, lat: 0, lon: 0, depth: 10, ...over }) as Quake;

describe('muro', () => {
	it('avisa de terremotos fuertes y temas enormes recientes, del más nuevo al más viejo', () => {
		const w = buildWall(
			[
				imp({ k: 'big', title: 'Big', titleEs: 'Grande', sources: ['1', '2', '3', '4', '5', '6'], sections: ['a', 'b', 'c'], first: ago(0.5) }),
				imp({ k: 'old', sources: ['1', '2', '3', '4', '5', '6'], sections: ['a', 'b', 'c'], first: ago(5) }),
				imp({ k: 'small' })
			],
			[quake({}), quake({ id: 'weak', mag: 6.2 }), quake({ id: 'tsu', mag: 6.1, tsunami: true, time: ago(2) }), quake({ id: 'old', time: ago(4) })],
			[],
			NOW
		);
		expect(w.alerts.map((a) => a.title)).toEqual(['Grande', 'Terremoto de magnitud 7', 'Terremoto de magnitud 6,1']);
		expect(w.alerts[2].detail).toContain('tsunami');
		expect(w.headlines.map((h) => h.title)).toEqual(['Grande', 'Title', 'Title']);
	});

	it('la cinta, sin precios rotos', () => {
		const q = (symbol: string, price: number) => ({ symbol, price, changePct: 1, change: 1, prevClose: 1, time: null }) as Quote;
		expect(buildWall([], [], [q('NVDA', 120), q('X', NaN)], NOW).tape.map((t) => t.symbol)).toEqual(['NVDA']);
	});

	it('rota igual para todos y enseña el aviso un rato de cada minuto', () => {
		expect(rotation(4, 0, 10)).toBe(0);
		expect(rotation(4, 25_000, 10)).toBe(2);
		expect(rotation(0, 25_000, 10)).toBe(0);
		expect(alertShowing(5_000)).toBe(true);
		expect(alertShowing(30_000)).toBe(false);
	});
});
