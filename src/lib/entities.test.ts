import { describe, expect, it } from 'vitest';
import { entitiesIn, findEntity } from './entities.ts';

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

	it('encuentra los nombres con ficha de un titular, y cada uno abre su ficha', () => {
		const links = entitiesIn('Lagarde avisa de que el BCE vigilará el yen y a Nvidia en Japón');
		expect(links.map((l) => l.label)).toEqual(['NVIDIA', 'Lagarde', 'BCE']);
		expect(entitiesIn('Lagarde avisa de que el BCE vigilará a Nvidia en Japón', 5).map((l) => l.query)).toEqual([
			'NVDA',
			'Christine Lagarde',
			'BCE',
			'Japón'
		]);
		for (const l of entitiesIn('Japón y la Fed', 5)) expect(findEntity(l.query)).not.toBeNull();
		expect(entitiesIn('La meta de déficit')).toEqual([]);
	});
});

describe('findEntity con upperCodes (NEWS)', () => {
	it('los códigos cortos solo en mayúsculas', () => {
		expect(findEntity('es', { upperCodes: true })).toBeNull();
		expect(findEntity('us', { upperCodes: true })).toBeNull();
		expect(findEntity('ES', { upperCodes: true })).toMatchObject({ kind: 'country', country: { code: 'ES' } });
		expect(findEntity('nvda', { upperCodes: true })).toMatchObject({ kind: 'ticker', ticker: { code: 'NVDA' } });
		expect(findEntity('España', { upperCodes: true })).toMatchObject({ kind: 'country', country: { code: 'ES' } });
	});
});
