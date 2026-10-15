import { describe, expect, it } from 'vitest';
import { alertHit, alertText, parseAlert, parseMis, parseNumber, parseTitle, parseWords } from './useralerts.ts';

describe('parseNumber', () => {
	it('acepta coma o punto decimal', () => {
		expect(parseNumber('1,40')).toBe(1.4);
		expect(parseNumber('1.234,5')).toBe(1234.5);
		expect(parseNumber('150')).toBe(150);
		expect(parseNumber('- 5')).toBe(-5);
		expect(parseNumber('abc')).toBeNull();
	});
});

describe('parseAlert', () => {
	it('nivel de precio', () => {
		expect(parseAlert('NVDA > 150')).toMatchObject({ asset: 'NVDA', op: '>', value: 150 });
		expect(parseAlert('nvda>150')).toMatchObject({ asset: 'NVDA', op: '>', value: 150 });
		expect(parseAlert('diésel < 1,40')).toMatchObject({ asset: 'diesel', op: '<', value: 1.4, unit: '€/L' });
	});
	it('variación del día', () => {
		expect(parseAlert('BTC -5%')).toMatchObject({ asset: 'coin:bitcoin', op: '%', value: -5 });
		expect(parseAlert('ETH 3 %')).toMatchObject({ asset: 'coin:ethereum', op: '%', value: 3 });
	});
	it('rechaza lo que no tiene sentido', () => {
		for (const bad of ['NVDA', 'NVDA 150', 'NVDA > 3%', 'NVDA > -1', 'NVDA 0%', 'NVDA 80%', '> 150', 'hola que tal > 1'])
			expect(parseAlert(bad), bad).toBeNull();
	});
});

describe('alertHit', () => {
	it('niveles y porcentajes', () => {
		const up = parseAlert('NVDA > 150')!;
		expect(alertHit(up, 150, 0)).toBe(true);
		expect(alertHit(up, 149.9, 0)).toBe(false);
		const down = parseAlert('BTC -5%')!;
		expect(alertHit(down, 1, -5.2)).toBe(true);
		expect(alertHit(down, 1, 6)).toBe(false);
		expect(alertHit(down, 1, null)).toBe(false);
	});
	it('texto del aviso', () => {
		expect(alertText(parseAlert('BTC -5%')!)).toBe('Bitcoin −5 %');
		expect(alertText(parseAlert('diesel < 1,40')!)).toBe('Diésel (media de España) < 1,4 €/L');
	});
});

describe('issues', () => {
	it('título', () => {
		expect(parseTitle('[alerta] NVDA > 150')).toEqual({ kind: 'alerta', payload: 'NVDA > 150' });
		expect(parseTitle('Fuente caída: BOE')).toBeNull();
	});
	it('listas con topes', () => {
		expect(parseMis('nvda, AAPL nvda <x>')).toEqual(['NVDA', 'AAPL']);
		expect(parseWords('aranceles, Aranceles, , vivienda')).toEqual(['Aranceles', 'vivienda']);
	});
});
