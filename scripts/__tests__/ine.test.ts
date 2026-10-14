// INE (wstempus): IPC y paro de España y Baleares.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ine } from '../sources/ine.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

/** Forma de DATOS_SERIE: Data con Anyo, FK_Periodo (1–12 meses, 19–22 trimestres) y Valor. */
const serie = (cod: string, nombre: string, data: [number, number, number | null][]) => ({
	COD: cod,
	Nombre: nombre,
	FK_Unidad: 135,
	FK_Escala: 1,
	Data: data.map(([Anyo, FK_Periodo, Valor]) => ({ Fecha: 0, FK_TipoDato: 1, FK_Periodo, Anyo, Valor, Secreto: false }))
});

const ipcEs = serie('IPC290750', 'Total Nacional. General. Variación anual.', [[2026, 9, 2.9], [2026, 8, 2.7]]);
const ipcIb = serie('IPC293827', 'Balears, Illes. General. Variación anual.', [[2026, 9, 3.1]]);
const epaEs = serie('EPA423474', 'Total Nacional. Tasa de paro. Ambos sexos.', [[2026, 20, 10.3], [2026, 19, 11.4]]);
/** DATOS_TABLA: una lista de series; hay que encontrar la de Baleares, ambos sexos y todas las edades. */
const epaTable = [
	serie('EPA111', 'Ambos sexos. Balears, Illes. De 16 a 19 años. Tasa de paro de la población.', [[2026, 20, 30]]),
	serie('EPA222', 'Hombres. Balears, Illes. Total. Tasa de paro de la población.', [[2026, 20, 6]]),
	serie('EPA333', 'Ambos sexos. Balears, Illes. Total. Tasa de paro de la población.', [[2026, 20, 6.1], [2026, 19, 9.8]])
];

function api(over: Record<string, object> = {}) {
	const replies: Record<string, object> = { IPC290750: ipcEs, IPC293827: ipcIb, EPA423474: epaEs, '14506': epaTable, ...over };
	return (url: string) => replies[new URL(url).pathname.split('/').pop()!];
}

describe('ine', () => {
	it('lee las series por código y la de Baleares de la tabla de la EPA', async () => {
		const fetch = mockFetch(api());
		const { series } = await ine.fetch(undefined);
		const byId = Object.fromEntries(series.map((s) => [s.id, s]));
		expect(Object.keys(byId)).toEqual(['ipc-es', 'ipc-ib', 'epa-es', 'epa-ib']);
		expect(byId['ipc-es']).toEqual({
			id: 'ipc-es',
			label: 'IPC (INE)',
			unit: '%',
			geo: 'ES',
			points: [
				{ t: '2026-08', v: 2.7 },
				{ t: '2026-09', v: 2.9 }
			],
			source: 'INE',
			url: 'https://www.ine.es/consul/serie.do?s=IPC290750'
		});
		expect(byId['epa-es'].points).toEqual([
			{ t: '2026-Q1', v: 11.4 },
			{ t: '2026-Q2', v: 10.3 }
		]);
		// De la tabla sale la serie buena, con su código.
		expect(byId['epa-ib'].points.at(-1)).toEqual({ t: '2026-Q2', v: 6.1 });
		expect(byId['epa-ib'].url).toBe('https://www.ine.es/consul/serie.do?s=EPA333');
		const urls = fetch.mock.calls.map((c) => String(c[0]));
		expect(urls).toContain('https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290750?nult=25');
		expect(urls).toContain('https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/14506?nult=13');
	});

	it('descarta datos sin valor o con periodo raro, y series sin datos o sin coincidencia', async () => {
		mockFetch(
			api({
				// Valor nulo (dato no publicado), periodo anual (28) y sin año: fuera.
				IPC290750: { ...ipcEs, Data: [...ipcEs.Data, { FK_Periodo: 10, Anyo: 2026, Valor: null }, { FK_Periodo: 28, Anyo: 2025, Valor: 2.8 }, { FK_Periodo: 7, Valor: 1 }] },
				IPC293827: { COD: 'IPC293827', Data: null },
				EPA423474: { COD: 'EPA423474' },
				'14506': [serie('EPA9', 'Mujeres. Balears, Illes. Total.', [[2026, 20, 7]])]
			})
		);
		const { series } = await ine.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['ipc-es']);
		expect(series[0].points).toEqual([
			{ t: '2026-08', v: 2.7 },
			{ t: '2026-09', v: 2.9 }
		]);
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ine · epa-ib: sin serie que encaje'));
	});

	it('lanza un error si ninguna serie trae datos', async () => {
		mockFetch(() => []);
		await expect(ine.fetch(undefined)).rejects.toThrow('ninguna serie del INE');
	});
});
