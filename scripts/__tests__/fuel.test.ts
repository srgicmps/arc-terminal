import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkData, checkShrink, writeExtra } from '../lib.ts';
import { fuel, fuelSpain } from '../sources/fuel.ts';
import { mockFetch } from './mock.ts';

// fuelSpain escribe un archivo por provincia: en los tests no se toca el disco.
vi.mock('../lib.ts', async (original) => ({
	...(await original<typeof import('../lib.ts')>()),
	writeExtra: vi.fn(async () => {})
}));

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
	'Precio Gasolina 98 E5': '',
	'Precio Gases licuados del petróleo': '',
	...over
});

const body = {
	Fecha: '14/10/2026 12:30:05',
	ListaEESSPrecio: [
		station({}),
		station({ IDEESS: '2', 'C.P.': '07740', Municipio: 'Mercadal (Es)', 'Rótulo': 'BP', 'Precio Gasolina 95 E5': '1,700', 'Precio Gasoleo A': '', 'Precio Gasolina 98 E5': '1,800' }),
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
			prices: { g95: 1.6, diesel: 1.5, g98: null, glp: null }
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
			history: [
				{
					date: '2026-10-13',
					avg: { g95: 1.5, diesel: 1.4, g98: null, glp: null },
					min: { g95: 1.5, diesel: 1.4, g98: null, glp: null }
				}
			]
		};
		const data = await fuel.fetch(previous);
		expect(data.history).toEqual([
			previous.history[0],
			{
				date: '2026-10-14',
				avg: { g95: 1.65, diesel: 1.5, g98: 1.8, glp: null },
				min: { g95: 1.6, diesel: 1.5, g98: 1.8, glp: null }
			}
		]);
	});

	it('falla si la API cambia de forma o no hay ninguna estación de Menorca', async () => {
		mockFetch(() => ({ Fecha: 'x' }));
		await expect(fuel.fetch(undefined)).rejects.toThrow('ListaEESSPrecio');
		mockFetch(() => ({ Fecha: 'x', ListaEESSPrecio: [station({ 'C.P.': '07001' })] }));
		await expect(fuel.fetch(undefined)).rejects.toThrow('ninguna estación');
	});

	it('fuelSpain agrupa por provincia, escribe un archivo por provincia y calcula las medias', async () => {
		// Hacen falta al menos 40 provincias para dar la respuesta por buena.
		const raws = Array.from({ length: 40 }, (_, i) =>
			station({ IDEESS: `p${i}`, IDProvincia: String(i + 10), Provincia: `PROVINCIA ${i + 10}` })
		);
		raws.push(
			station({ IDEESS: 'm2', IDProvincia: '07', Provincia: 'BALEARS (ILLES)', Latitud: '40,003', 'Precio Gasolina 95 E5': '1,700' }),
			station({ IDEESS: 'x', IDProvincia: '', Provincia: '' })
		);
		const fetch = mockFetch(() => ({ Fecha: '14/10/2026 12:30:05', ListaEESSPrecio: raws }));
		const data = await fuelSpain.fetch(undefined);
		expect(String(fetch.mock.calls[0][0])).toMatch(/EstacionesTerrestres\/$/);
		expect(data.sourceDate).toBe('14/10/2026 12:30:05');
		expect(data.provinces).toHaveLength(41);
		const baleares = data.provinces.find((p) => p.id === '07')!;
		expect(baleares).toEqual({
			id: '07',
			name: 'Illes Balears',
			count: 1,
			lat: 40.003,
			lon: 3.84,
			avg: { g95: 1.7, diesel: 1.5, g98: null, glp: null },
			min: { g95: 1.7, diesel: 1.5, g98: null, glp: null }
		});
		// Por provincia: sus gasolineras y su historial.
		expect(writeExtra).toHaveBeenCalledTimes(82);
		expect(writeExtra).toHaveBeenCalledWith('fuel/07.json', expect.arrayContaining([expect.objectContaining({ id: 'm2' })]));
		expect(writeExtra).toHaveBeenCalledWith('fuel/history/07.json', [
			{ date: '2026-10-14', avg: { g95: 1.7, diesel: 1.5, g98: null, glp: null } }
		]);
		expect(fuelSpain.files?.(data)).toContain('fuel/07.json');
		expect(fuelSpain.files?.(data)).toContain('fuel/history/07.json');
		expect(data.avg.g95).toBeCloseTo((1.6 * 40 + 1.7) / 41, 3);
		expect(data.history).toHaveLength(1);
		expect(data.history![0]).toMatchObject({ date: '2026-10-14', avg: data.avg });
		expect(data.history![0].provinces?.['07']).toEqual({ g95: 1.7, diesel: 1.5, g98: null, glp: null });

		// Al día siguiente se añade otro punto al historial publicado.
		const old = { date: '2026-10-13', avg: { g95: 1.5, diesel: 1.4, g98: null, glp: null } };
		const next = await fuelSpain.fetch({ ...data, history: [old] });
		expect(next.history?.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14']);
	});

	it('fuelSpain falla si faltan provincias', async () => {
		mockFetch(() => ({ Fecha: 'x', ListaEESSPrecio: [station({ IDProvincia: '07', Provincia: 'BALEARS (ILLES)' })] }));
		await expect(fuelSpain.fetch(undefined)).rejects.toThrow('solo 1 provincias');
	});
});

describe('validate de fuel y fuel-es', () => {
	const prices = (g95: number | null, diesel: number | null = g95) => ({ g95, diesel, g98: null, glp: null });

	it('da por buenas las gasolineras con precios en €/L', async () => {
		mockFetch(() => body);
		const data = await fuel.fetch(undefined);
		expect(checkData(data, fuel)).toBeNull();
	});

	it('caza que la API renombre el campo del precio: siguen las estaciones, todas a null', async () => {
		// «Precio Gasolina 95 E5» → «Precio Gasolina 95 E5 (€/l)», y así con todos.
		const renamed = body.ListaEESSPrecio.map((raw) =>
			Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.startsWith('Precio ') ? `${k} (€/l)` : k, v]))
		);
		mockFetch(() => ({ ...body, ListaEESSPrecio: renamed }));
		const data = await fuel.fetch(undefined);
		expect(data.stations).toHaveLength(2);
		// checkShrink no lo ve (hay el mismo número de estaciones); validate, sí.
		expect(checkShrink(data, { stations: [{}, {}] }, fuel)).toBeNull();
		expect(checkData(data, fuel)).toBe('datos raros: solo el 0 % de las gasolineras tiene algún precio entre 0,5 y 4 €/L');
	});

	it('caza precios en céntimos y tolera algunas estaciones sin precio', () => {
		const station = (p: ReturnType<typeof prices>) => ({ id: '', name: '', address: '', town: '', schedule: '', lat: 0, lon: 0, prices: p });
		const cents = { sourceDate: '', stations: [station(prices(159.9)), station(prices(149.9))] };
		expect(checkData(cents, fuel)).toMatch(/0 % de las gasolineras/);
		const some = { sourceDate: '', stations: [station(prices(1.6)), station(prices(null))] };
		expect(checkData(some, fuel)).toBeNull();
	});

	it('fuel-es: provincias y media de España con precio, o datos raros', () => {
		const province = (avg: ReturnType<typeof prices>) => ({ id: '07', name: 'Illes Balears', count: 1, lat: 0, lon: 0, avg, min: avg });
		const good = { sourceDate: '', provinces: [province(prices(1.6)), province(prices(1.7))], avg: prices(1.65) };
		expect(checkData(good, fuelSpain)).toBeNull();
		const allNull = { sourceDate: '', provinces: [province(prices(null)), province(prices(null))], avg: prices(null) };
		expect(checkShrink(allNull, good, fuelSpain)).toBeNull();
		expect(checkData(allNull, fuelSpain)).toMatch(/0 % de las provincias/);
		expect(checkData({ ...good, avg: prices(null) }, fuelSpain)).toMatch(/media de España/);
	});
});
