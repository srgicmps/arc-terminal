import { describe, expect, it } from 'vitest';
import { parsePinkSheet, pinkChanges, pinkLink } from './pinksheet.ts';

describe('Pink Sheet del Banco Mundial', () => {
	const cells: unknown[][] = [
		['World Bank Commodity Price Data (The Pink Sheet)'],
		[],
		[null, 'Crude oil, average', 'Cocoa', 'Nickel', 'Potassium chloride **', 'Urea '],
		[null, '($/bbl)', '($/kg)', '($/mt)', '($/mt)', '($/mt)'],
		['2025M09', 70, 7.1, 15000, 350, '…'],
		['2026M08', 65, 6.2, 15500, 360, 400],
		['2026M09', 66, 6.0, 15800, 355, 410]
	];

	it('lee las columnas que se piden, con su unidad y sus meses', () => {
		const rows = parsePinkSheet(cells);
		expect(rows.map((r) => r.id)).toEqual(['cocoa', 'urea', 'potash', 'nickel']);
		expect(rows[0]).toMatchObject({ label: 'Cacao', unit: '$/kg', points: [{ t: '2025-09', v: 7.1 }, { t: '2026-08', v: 6.2 }, { t: '2026-09', v: 6 }] });
		// «Urea » con espacio y «Potassium chloride **» con la marca de nota; el «…» no cuenta.
		expect(rows[1].points.map((p) => p.t)).toEqual(['2026-08', '2026-09']);
		expect(rows[2].unit).toBe('$/mt');
	});

	it('sin la fila de nombres no devuelve nada', () => {
		expect(parsePinkSheet([['x'], ['2026M09', 1]])).toEqual([]);
	});

	it('encuentra el enlace al .xlsx mensual en la página', () => {
		const html = '<a href="https://thedocs.worldbank.org/en/doc/abc-0050012025/related/CMO-Historical-Data-Monthly.xlsx">Monthly prices</a>';
		expect(pinkLink(html)).toBe('https://thedocs.worldbank.org/en/doc/abc-0050012025/related/CMO-Historical-Data-Monthly.xlsx');
		expect(pinkLink('<a href="/x.pdf">')).toBeNull();
		// Solo del Banco Mundial: otro dominio (aunque lo imite) no vale, y se toma el siguiente que sí lo sea.
		expect(pinkLink('<a href="https://evil.example/CMO-Historical-Data-Monthly.xlsx">')).toBeNull();
		expect(pinkLink('<a href="https://worldbank.org.evil.example/CMO-Historical-Data-Monthly.xlsx">')).toBeNull();
		expect(pinkLink('<a href="https://evil.example/CMO-Historical-Data-Monthly.xlsx"> <a href="https://thedocs.worldbank.org/x/CMO-Historical-Data-Monthly.xlsx">')).toBe(
			'https://thedocs.worldbank.org/x/CMO-Historical-Data-Monthly.xlsx'
		);
	});
});

describe('variaciones del Pink Sheet', () => {
	it('compara con el mes anterior y con el mismo mes de hace un año', () => {
		const c = pinkChanges([{ t: '2025-09', v: 100 }, { t: '2026-08', v: 200 }, { t: '2026-09', v: 150 }]);
		expect(c.month).toBeCloseTo(-25);
		expect(c.year).toBeCloseTo(50);
		expect(pinkChanges([{ t: '2026-09', v: 1 }])).toEqual({ month: null, year: null });
	});
});
