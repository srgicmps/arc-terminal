// Índice FAO: lectura de la hoja mensual y fecha de publicación.
import { describe, expect, it } from 'vitest';
import { monthOf, parseFaoSheet, releaseDate } from './fao.ts';

const SHEET: unknown[][] = [
	['FAO Food Price Index'],
	['2014-2016=100'],
	[],
	['Date', 'Food Price Index', 'Meat', 'Dairy', 'Cereals', 'Vegetable Oils', 'Sugar', null, 'Food Price Index (real)'],
	[new Date(Date.UTC(2026, 7, 1)), 128.1, 126.0, 150.2, 108.3, 160.4, 103.9, null, 120],
	['2026-09', 129.0, 127.5, 149.0, 107.9, 165.2, 101.0, null, 121],
	['Source: FAO']
];

describe('FAO', () => {
	it('meses en varios formatos', () => {
		expect(monthOf(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01');
		expect(monthOf('2026-9')).toBe('2026-09');
		expect(monthOf('09/2026')).toBe('2026-09');
		expect(monthOf('Source')).toBeNull();
	});

	it('lee las seis series por el nombre de su columna (la nominal)', () => {
		const series = parseFaoSheet(SHEET);
		expect(series.map((s) => s.id)).toEqual(['fao-food', 'fao-cereals', 'fao-oils', 'fao-meat', 'fao-dairy', 'fao-sugar']);
		expect(series[0].points).toEqual([
			{ t: '2026-08', v: 128.1 },
			{ t: '2026-09', v: 129 }
		]);
		expect(series[2].points.at(-1)).toEqual({ t: '2026-09', v: 165.2 });
		expect(series[0].source).toBe('FAO');
	});

	it('el CSV de la FAO, partido por comas', () => {
		const csv = 'FAO Food Price Index,,,\n2014-2016=100,,,\nDate,Food Price Index,Meat,Dairy,Cereals,Oils,Sugar,,\n,,,,\n2026-09,136.0,127.9,119.1,122.8,198.6,114.0,,';
		const series = parseFaoSheet(csv.split('\n').map((l) => l.split(',')));
		expect(series.map((s) => s.points[0].v)).toEqual([136, 122.8, 198.6, 127.9, 119.1, 114]);
	});

	it('sin cabecera, nada', () => {
		expect(parseFaoSheet([['a', 'b'], [1, 2]])).toEqual([]);
	});

	it('fecha de publicación', () => {
		expect(releaseDate('<p>Release date: 03/10/2026</p>')).toBe('2026-10-03');
		expect(releaseDate('<b>Release date:</b> 3 October 2026')).toBe('2026-10-03');
		expect(releaseDate('nada')).toBeNull();
		// Como en la página real: el calendario de publicaciones va antes que la fecha del último dato.
		const page =
			'<p>Next release dates for 2026: 9 January, 6 February, 6 March, 3 April, 8 May, 5 June, 3 July, 7 August</p>' +
			'<p>Release date: 02/10/2026&nbsp; Download datasets: Excel: Nominal and real indices from 1990</p>';
		expect(releaseDate(page)).toBe('2026-10-02');
	});
});
