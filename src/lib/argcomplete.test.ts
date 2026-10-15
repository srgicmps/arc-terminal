// Autocompletar el argumento de un comando en la barra.
import { describe, expect, it } from 'vitest';
import { argOptions } from './argcomplete.ts';

const runs = (raw: string) => argOptions(raw)?.map((o) => o.run);

describe('argOptions', () => {
	it('con «LIDER » y nada más, todos los líderes', () => {
		const list = argOptions('LIDER ');
		expect(list?.length).toBeGreaterThanOrEqual(5);
		expect(list?.every((o) => o.kind === 'Líder' && o.run?.startsWith('LIDER '))).toBe(true);
	});

	it('filtra por nombre o alias, sin tildes ni mayúsculas', () => {
		expect(runs('lider lag')).toEqual(['LIDER lagarde']);
		expect(runs('LIDER sanch')).toEqual(['LIDER sanchez']);
		expect(runs('líderes bce')?.[0]).toBe('LIDER lagarde');
	});

	it('países por nombre, código, nombre en inglés o gentilicio', () => {
		expect(runs('PAIS alem')?.[0]).toBe('PAIS DE');
		expect(runs('pais germany')?.[0]).toBe('PAIS DE');
		expect(runs('PAIS japon')?.[0]).toBe('PAIS JP');
		expect(runs('país francés')?.[0]).toBe('PAIS FR');
	});

	it('provincias por nombre o número, y Menorca', () => {
		expect(runs('FUEL mad')?.[0]).toBe('FUEL 28');
		expect(runs('gasolina 28')?.[0]).toBe('FUEL 28');
		expect(runs('FUEL coru')).toEqual(['FUEL 15']);
		expect(runs('FUEL men')?.[0]).toBe('FUEL Menorca');
	});

	it('CMP completa la última palabra y TV el último código', () => {
		expect(runs('CMP NVDA AM')).toContain('CMP NVDA AMD');
		expect(runs('TV TOP,W')).toContain('TV TOP,WS');
	});

	it('null si no es un comando con argumento, sin espacio o sin coincidencias', () => {
		expect(argOptions('LIDER')).toBeNull();
		expect(argOptions('ECO paro')).toBeNull();
		expect(argOptions('NEWS infl')).toBeNull();
		expect(argOptions('NVDA G')).toBeNull();
		expect(argOptions('LIDER zzzz')).toBeNull();
	});
});
