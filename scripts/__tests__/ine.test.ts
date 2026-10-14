import { describe, expect, it, vi } from 'vitest';
import { ine } from '../sources/ine.ts';
import { mockFetch } from './mock.ts';

// Datos con la forma de la API wstempus: FK_Periodo 1–12 son meses y 19–22, trimestres.
const serie = (cod: string, nombre: string, data: [number, number, number][]) => ({
	COD: cod,
	Nombre: nombre,
	Data: data.map(([Anyo, FK_Periodo, Valor]) => ({ Anyo, FK_Periodo, Valor }))
});

describe('ine', () => {
	it('pasa los turistas a millones y lee el IPV trimestral', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => {
			if (url.includes('/DATOS_SERIE/FREG286')) return serie('FREG286', 'Turista. Total Nacional.', [[2026, 8, 11_500_000], [2026, 7, 11_000_000]]);
			if (url.includes('/DATOS_SERIE/IPV1376')) return serie('IPV1376', 'Nacional. General. Variación anual.', [[2026, 19, 9.1], [2026, 20, 8.4]]);
			if (url.includes('/DATOS_SERIE/IPV1670')) return serie('IPV1670', 'Balears, Illes. General. Variación anual.', [[2026, 20, 7.2]]);
			return undefined;
		});
		const { series } = await ine.fetch(undefined);
		const get = (id: string) => series.find((s) => s.id === id);
		expect(get('turistas-es')).toMatchObject({
			unit: 'mill.',
			points: [
				{ t: '2026-07', v: 11 },
				{ t: '2026-08', v: 11.5 }
			]
		});
		expect(get('ipv-es')).toMatchObject({
			unit: '%',
			points: [
				{ t: '2026-Q1', v: 9.1 },
				{ t: '2026-Q2', v: 8.4 }
			]
		});
		expect(get('ipv-ib')?.points).toEqual([{ t: '2026-Q2', v: 7.2 }]);
	});
});
