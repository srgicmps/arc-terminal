import { describe, expect, it } from 'vitest';
import { GLOSSARY, lookup } from './glossary.ts';

describe('glossary', () => {
	it('tiene unas 40 entradas, sin ids repetidos y con definiciones cortas', () => {
		expect(GLOSSARY.length).toBeGreaterThanOrEqual(40);
		expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length);
		for (const e of GLOSSARY) {
			expect(e.def.length).toBeLessThanOrEqual(200);
			expect(e.match.length).toBeGreaterThan(0);
		}
	});

	it('encuentra el término en las etiquetas de las series', () => {
		const id = (t: string) => lookup(t)?.id;
		expect(id('Euríbor a 12 meses')).toBe('euribor');
		expect(id('€STR')).toBe('estr');
		expect(id('Inflación (IPCA)')).toBe('hicp');
		expect(id('Inflación (IPC)')).toBe('cpi');
		expect(id('IPC (INE)')).toBe('cpi');
		expect(id('Inflación zona euro')).toBe('hicp');
		expect(id('Peticiones de paro (miles)')).toBe('claims');
		expect(id('Refinanciación')).toBe('mro');
		expect(id('Inflación subyacente')).toBe('core');
		expect(id('PCE subyacente, interanual')).toBe('pce');
		expect(id('Paro juvenil (<25)')).toBe('youth');
		expect(id('Paro (EPA)')).toBe('epa');
		expect(id('Solicitudes de paro (miles)')).toBe('claims');
		expect(id('Paro')).toBe('unemployment');
		expect(id('Deuda / PIB')).toBe('debt');
		expect(id('PIB, trimestral')).toBe('gdp');
		expect(id('Diferencial 10 años − 2 años')).toBe('spread-10-2');
		expect(id('Bono a 10 años')).toBe('bond10');
		expect(id('Zona euro · BCE')).toBe('policy');
		expect(id('M2, interanual')).toBe('m2');
		expect(id('Petróleo WTI')).toBe('wti');
		expect(id('Dólar, índice amplio')).toBe('dxy');
		expect(id('Precio de la vivienda (IPV)')).toBe('ipv');
		expect(id('Prima frente a Alemania')).toBe('premium');
		expect(id('Prima España (pb)')).toBe('premium');
	});

	it('por id, y nada si no lo conoce o es parte de otra palabra', () => {
		expect(lookup('elo')?.term).toBe('Elo');
		expect(lookup('Turistas internacionales')).toBeUndefined();
		expect(lookup('Telo')).toBeUndefined();
		expect(lookup('')).toBeUndefined();
		expect(lookup(undefined)).toBeUndefined();
	});
});
