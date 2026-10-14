import { describe, expect, it } from 'vitest';
import { findEntity } from './entities.ts';

describe('fichas de NEWS', () => {
	it('encuentra valores por código, nombre o alias', () => {
		expect(findEntity('NVDA')).toMatchObject({ kind: 'ticker', ticker: { code: 'NVDA' } });
		expect(findEntity('nvidia')).toMatchObject({ kind: 'ticker', ticker: { code: 'NVDA' } });
		expect(findEntity('Google')).toMatchObject({ kind: 'ticker', ticker: { code: 'GOOGL' } });
	});

	it('encuentra líderes por nombre o apellido, sin tildes', () => {
		expect(findEntity('Lagarde')).toMatchObject({ kind: 'leader', leader: { id: 'lagarde' } });
		expect(findEntity('pedro sanchez')).toMatchObject({ kind: 'leader', leader: { id: 'sanchez' } });
	});

	it('encuentra bancos centrales', () => {
		expect(findEntity('BCE')).toEqual({ kind: 'bank', bank: 'ecb' });
		expect(findEntity('Reserva Federal')).toEqual({ kind: 'bank', bank: 'fed' });
	});

	it('encuentra países solo por el nombre entero', () => {
		expect(findEntity('Japón')).toMatchObject({ kind: 'country', country: { code: 'JP' } });
		expect(findEntity('reino')).toBeNull();
	});

	it('nada si es una búsqueda de varias cosas o vacía', () => {
		expect(findEntity('inflación en Japón')).toBeNull();
		expect(findEntity('')).toBeNull();
		expect(findEntity('aranceles')).toBeNull();
	});
});
