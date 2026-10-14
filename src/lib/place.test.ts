// «Tu sitio»: lectura del enlace, buscador de ciudades, España/Menorca y el comando LUGAR.
import { describe, expect, it } from 'vitest';
import { resolveInput, targetPath } from './cmdline.ts';
import { nearSea } from './localweather.ts';
import { DEFAULT_PLACE, inMenorca, inSpain, parseGeocoding, parsePlaceParam, placeParam, toPlace } from './place.ts';

describe('place', () => {
	it('lee y escribe ?lugar=lat,lon,nombre (el nombre puede llevar comas)', () => {
		const p = parsePlaceParam('35.69,139.69,Tokio, Japón');
		expect(p).toMatchObject({
			name: 'Tokio, Japón',
			lat: 35.69,
			lon: 139.69,
			cc: '',
			tz: ''
		});
		expect(parsePlaceParam(placeParam(p!))?.name).toBe('Tokio, Japón');
		expect(parsePlaceParam('99,0,Nada')).toBeNull();
		expect(parsePlaceParam('a,b,c')).toBeNull();
		expect(parsePlaceParam(null)).toBeNull();
	});

	it('descarta lo guardado si no tiene nombre o coordenadas', () => {
		expect(toPlace({ name: '', lat: 1, lon: 1 })).toBeNull();
		expect(toPlace({ name: 'X', lat: '1', lon: 1 })).toBeNull();
		expect(toPlace(DEFAULT_PLACE)).toEqual(DEFAULT_PLACE);
	});

	it('sabe si está en España (por país o por zona horaria) y en Menorca', () => {
		expect(inSpain(DEFAULT_PLACE)).toBe(true);
		expect(inMenorca(DEFAULT_PLACE)).toBe(true);
		const gps = {
			name: 'Mi ubicación',
			country: '',
			cc: '',
			lat: 28.1,
			lon: -15.4,
			tz: 'Atlantic/Canary'
		};
		expect(inSpain(gps)).toBe(true);
		expect(inMenorca(gps)).toBe(false);
		expect(inSpain({ ...gps, cc: 'PT', tz: 'Europe/Lisbon' })).toBe(false);
		// Mallorca no es Menorca.
		expect(inMenorca({ ...DEFAULT_PLACE, lat: 39.57, lon: 2.65 })).toBe(false);
	});

	it('convierte los resultados del buscador', () => {
		const raw = {
			results: [
				{
					name: 'Tokio',
					latitude: 35.69,
					longitude: 139.69,
					country: 'Japón',
					country_code: 'jp',
					admin1: 'Tokio',
					timezone: 'Asia/Tokyo'
				},
				{ name: 'Roto', latitude: null, longitude: 1 }
			]
		};
		expect(parseGeocoding(raw)).toEqual([
			{
				name: 'Tokio',
				country: 'Japón',
				cc: 'JP',
				admin1: 'Tokio',
				lat: 35.69,
				lon: 139.69,
				tz: 'Asia/Tokyo'
			}
		]);
		expect(parseGeocoding({})).toEqual([]);
	});

	it('el mar solo cuenta si la celda queda cerca', () => {
		expect(nearSea({ latitude: 39.9, longitude: 4.3 }, DEFAULT_PLACE)).toBe(true);
		// Madrid: la celda de mar más cercana está a cientos de km.
		expect(nearSea({ latitude: 39.5, longitude: -0.3 }, { ...DEFAULT_PLACE, lat: 40.42, lon: -3.7 })).toBe(false);
		expect(nearSea({}, DEFAULT_PLACE)).toBe(false);
	});

	it('LUGAR Tokio abre WX con la búsqueda', () => {
		const t = resolveInput('LUGAR Tokio', []);
		expect(t && targetPath(t)).toEqual({
			route: '/wx',
			search: '?buscar=Tokio'
		});
	});
});
