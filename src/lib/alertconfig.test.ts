import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, groupOf, GROUPS, inQuiet, parseConfig, wants } from './alertconfig.ts';

describe('alertconfig', () => {
	it('parseConfig: por defecto, el básico; limpia lo que no vale', () => {
		expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
		const c = parseConfig({
			on: true,
			groups: ['mercados', 'nada'],
			level: 9,
			daily: 500,
			mis: ['nvda', 'NVDA', 'mal símbolo'],
			quiet: { from: '23:00', until: '7:00' }
		});
		expect(c).toEqual({ ...DEFAULT_CONFIG, on: true, groups: ['mercados'], daily: 100, mis: ['NVDA'], quiet: null });
	});
	it('silencio que cruza la medianoche', () => {
		const q = { from: '23:00', until: '07:30' };
		expect(inQuiet('23:30', q)).toBe(true);
		expect(inQuiet('03:00', q)).toBe(true);
		expect(inQuiet('07:30', q)).toBe(false);
		expect(inQuiet('12:00', q)).toBe(false);
	});
	it('wants: grupo, nivel, silencio (los P1 llegan igual) y lo que es solo de Sergi', () => {
		const c = parseConfig({
			on: true,
			groups: ['mercados', 'desastres'],
			level: 2,
			quiet: { from: '23:00', until: '07:00' }
		});
		expect(wants(c, 'stock', 2, '12:00')).toBe(true);
		expect(wants(c, 'ai', 2, '12:00')).toBe(false);
		expect(wants(c, 'earnings', 3, '12:00')).toBe(false);
		expect(wants(c, 'stock', 2, '02:00')).toBe(false);
		expect(wants(c, 'quake', 1, '02:00')).toBe(true);
		expect(wants(c, 'user-alert', 1, '12:00')).toBe(false);
		expect(wants({ ...c, on: false }, 'quake', 1, '12:00')).toBe(false);
	});
	it('cada tipo está en un solo grupo', () => {
		const types = GROUPS.flatMap((g) => g.types as readonly string[]);
		expect(new Set(types).size).toBe(types.length);
		expect(groupOf('desconocido')).toBe('agenda');
	});
});

describe('alertas de precio y palabras (F14)', () => {
	it('newPrice da un id; parsePrices quita repetidas, raras y lo que pase del tope', async () => {
		const { newPrice, parsePrices, parseWordList } = await import('./alertconfig.ts');
		const { parseAlert } = await import('./useralerts.ts');
		const a = newPrice(parseAlert('NVDA > 150')!);
		expect(a.id).toMatch(/^[0-9a-f]{8}$/);
		const diesel = newPrice(parseAlert('diésel < 1,40')!);
		const btc = newPrice(parseAlert('BTC -5%')!);
		expect(parsePrices([a, { ...a, id: 'cccccccc' }, diesel, btc, { ...a, op: '!' }, 'x'])).toEqual([a, diesel, btc]);
		const many = Array.from({ length: 30 }, (_, i) => newPrice(parseAlert(`NVDA > ${i + 1}`)!));
		expect(parsePrices(many)).toHaveLength(20);
		expect(parseWordList(['  aranceles ', 'ARANCELES', '<b>', 3])).toEqual(['ARANCELES']);
	});
});
