import { describe, expect, it } from 'vitest';
import { airspacePoints, countriesIn, maritimePoints, quakePoints, sanctionPoints, straitPoints } from './layers.ts';

describe('capas del mapa', () => {
	it('encuentra países por nombre y gentilicio, sin confundir Sudán con Sudán del Sur', () => {
		expect(countriesIn('Designation of Russian and Iranian entities').map((c) => c.name)).toEqual(['Rusia', 'Irán']);
		expect(countriesIn('South Sudan-related designations').map((c) => c.name)).toEqual(['Sudán del Sur']);
		expect(countriesIn('Sudanese Rapid Support Forces').map((c) => c.name)).toEqual(['Sudán']);
		expect(countriesIn('Nothing here')).toEqual([]);
		expect(countriesIn('Tariffs on the European Union').map((c) => [c.name, c.code])).toEqual([['Unión Europea', undefined]]);
	});

	it('sanciones: un punto por país, más grande e intenso con más documentos', () => {
		const doc = (title: string, abstract = '') => ({ title, abstract, url: `https://fr/${title}` });
		const points = sanctionPoints([doc('Russia-related designations'), doc('Notice of OFAC Sanctions Actions', 'persons in Russia and Iran'), doc('Russian harmful foreign activities'), doc('Section 301 China')]);
		const russia = points.find((p) => p.title.startsWith('Rusia'))!;
		expect(russia).toMatchObject({ layer: 'sanctions', title: 'Rusia: 3 documentos', strong: true, url: 'https://fr/Russia-related designations', country: 'RU' });
		expect(points.map((p) => p.title.split(':')[0]).sort()).toEqual(['China', 'Irán', 'Rusia']);
	});

	it('estrechos con coordenadas fijas e intensos si caen más de un 10 %', () => {
		const c = (id: string, change: number | null) => ({ id, name: id, last: '2026-10-09', avg7: 120, avg7PrevYear: null, change, spark: [] });
		const points = straitPoints([c('chokepoint1', -51.4), c('chokepoint2', 15.2), c('chokepoint99', 0)]);
		expect(points.map((p) => [p.id, p.lat, p.lon, p.strong])).toEqual([
			['c-chokepoint1', 30.6, 32.33, true],
			['c-chokepoint2', 9.08, -79.68, false]
		]);
		expect(points[0].sub).toBe('120 barcos al día · -51,4 % en un año');
	});

	it('descarta lo que no tiene coordenadas', () => {
		const q = { id: '1', mag: 6.2, place: 'Japón', time: '', url: 'u', tsunami: false, alert: null, lat: NaN, lon: 140, depth: 10 };
		expect(quakePoints([q, { ...q, id: '2', lat: 35 }])).toMatchObject([{ id: 'q-2', strong: true }]);
	});
});

describe('airspacePoints (F22)', () => {
	it('sitúa cada CZIB en su país o zona y descarta lo que no sabe situar', () => {
		const c = (id: string, areaEn: string) => ({ id, area: areaEn, areaEn, issued: '2026-01-01', revised: null, validUntil: null, url: 'u' });
		const pts = airspacePoints([c('A', 'Ukraine'), c('B', 'the Persian Gulf and Gulf of Oman'), c('C', 'Atlantis')]);
		expect(pts.map((p) => [p.id, p.country])).toEqual([
			['a-A', 'UA'],
			['a-B', undefined]
		]);
		expect(pts[1].lat).toBe(26.2);
	});
});

describe('maritimePoints (F21)', () => {
	it('un punto por aviso con coordenadas', () => {
		const w = (id: string, at: [number, number] | null) => ({ id, region: 'Mar Rojo', place: '', kind: 'Minas', text: '', issued: null, at });
		expect(maritimePoints([w('A', [20, 38]), w('B', null)]).map((p) => [p.id, p.lat, p.lon])).toEqual([['n-A', 20, 38]]);
	});
});
