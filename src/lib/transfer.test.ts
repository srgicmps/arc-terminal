import { describe, expect, it } from 'vitest';
import { collect, decode, encode, portable } from './transfer.ts';

const store = (data: Record<string, string>) => ({
	length: Object.keys(data).length,
	key: (i: number) => Object.keys(data)[i] ?? null,
	getItem: (k: string) => data[k] ?? null
});

describe('llevar ajustes', () => {
	it('solo se lleva ajustes y datos de localStorage', () => {
		expect(portable('arc-watchlist')).toBe(true);
		expect(portable('arc-layout-top')).toBe(true);
		expect(portable('arc-localwx:39.9,4.2')).toBe(false);
		expect(portable('arc-last-visit')).toBe(false);
		expect(portable('arc-last-visit-session')).toBe(false);
		expect(portable('otra-cosa')).toBe(false);
	});
	it('ida y vuelta, con tildes', () => {
		const prefs = collect(store({ 'arc-watchlist': '["NVDA","SAN"]', 'arc-watchwords': '["vivienda","Menorca","energía"]', basura: 'x' }));
		expect(Object.keys(prefs)).toEqual(['arc-watchlist', 'arc-watchwords']);
		expect(decode(encode(prefs))).toEqual(prefs);
	});
	it('rechaza lo que no vale', () => {
		expect(decode('no-es-base64!!')).toBeNull();
		expect(decode(encode({ 'otra-cosa': '1' }))).toBeNull();
	});
});
