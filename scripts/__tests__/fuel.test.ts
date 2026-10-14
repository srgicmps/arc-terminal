import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fuel } from '../sources/fuel.ts';
import { mockFetch } from './mock.ts';

// Respuesta con la forma de la API del Ministerio: todo son textos, con coma decimal.
const station = (over: Record<string, string>) => ({
	'C.P.': '07760',
	IDEESS: '1',
	'Rótulo': 'REPSOL',
	'Dirección': 'CARRETERA ME-1 KM 2',
	Municipio: 'Ciutadella de Menorca',
	Horario: 'L-D: 24H ',
	Latitud: '40,001',
	'Longitud (WGS84)': '3,840',
	'Precio Gasolina 95 E5': '1,600',
	'Precio Gasoleo A': '1,500',
	...over
});

const body = {
	Fecha: '14/10/2026 12:30:05',
	ListaEESSPrecio: [
		station({}),
		station({ IDEESS: '2', 'C.P.': '07740', Municipio: 'Mercadal (Es)', 'Rótulo': 'BP', 'Precio Gasolina 95 E5': '1,700', 'Precio Gasoleo A': '' }),
		// Mallorca: se descarta por el código postal.
		station({ IDEESS: '3', 'C.P.': '07001', 'Precio Gasolina 95 E5': '1,100' }),
		// Sin coordenadas: se descarta.
		station({ IDEESS: '4', Latitud: '' })
	]
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('fuel', () => {
	it('se queda con las gasolineras de Menorca y limpia los textos', async () => {
		const fetch = mockFetch(() => body);
		const data = await fuel.fetch(undefined);
		expect(String(fetch.mock.calls[0][0])).toContain('/FiltroProvincia/07');
		expect(data.sourceDate).toBe('14/10/2026 12:30:05');
		expect(data.stations.map((s) => s.id)).toEqual(['1', '2']);
		expect(data.stations[0]).toEqual({
			id: '1',
			name: 'Repsol',
			address: 'Carretera ME-1 Km 2',
			town: 'Ciutadella de Menorca',
			schedule: 'L-D: 24H',
			lat: 40.001,
			lon: 3.84,
			prices: { g95: 1.6, diesel: 1.5 }
		});
		expect(data.stations[1].name).toBe('BP');
		expect(data.stations[1].town).toBe('Es Mercadal');
		expect(data.stations[1].prices.diesel).toBeNull();
	});

	it('calcula la media y el mínimo del día y los añade al historial', async () => {
		mockFetch(() => body);
		const previous = {
			sourceDate: '',
			stations: [],
			history: [{ date: '2026-10-13', avg: { g95: 1.5, diesel: 1.4 }, min: { g95: 1.5, diesel: 1.4 } }]
		};
		const data = await fuel.fetch(previous);
		expect(data.history).toEqual([
			previous.history[0],
			{ date: '2026-10-14', avg: { g95: 1.65, diesel: 1.5 }, min: { g95: 1.6, diesel: 1.5 } }
		]);
	});

	it('falla si la API cambia de forma o no hay ninguna estación de Menorca', async () => {
		mockFetch(() => ({ Fecha: 'x' }));
		await expect(fuel.fetch(undefined)).rejects.toThrow('ListaEESSPrecio');
		mockFetch(() => ({ Fecha: 'x', ListaEESSPrecio: [station({ 'C.P.': '07001' })] }));
		await expect(fuel.fetch(undefined)).rejects.toThrow('ninguna estación');
	});
});
