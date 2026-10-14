import { describe, expect, it, vi } from 'vitest';
import { mockFetch } from './mock.ts';

// La base de datos Access del MITECO no se puede fabricar en un test: se simulan fflate y mdb-reader con
// una tabla pequeña con las mismas columnas que el archivo real.
const rows: Record<string, unknown>[] = [];
vi.mock('fflate', () => ({ unzipSync: () => ({ 'BD-Embalses.mdb': new Uint8Array([1]) }) }));
vi.mock('mdb-reader', () => ({
	default: class {
		getTableNames = () => ['T_Datos Embalses'];
		getTable = () => ({
			getColumnNames: () => ['AMBITO_NOMBRE', 'EMBALSE_NOMBRE', 'FECHA', 'AGUA_TOTAL', 'AGUA_ACTUAL'],
			getData: () => rows
		});
	}
}));

const { water } = await import('../sources/water.ts');
vi.spyOn(console, 'log').mockImplementation(() => {});

const row = (ambito: string, fecha: string, total: number, actual: number) => ({
	AMBITO_NOMBRE: ambito,
	EMBALSE_NOMBRE: `${ambito} 1`,
	FECHA: new Date(`${fecha}T00:00:00Z`),
	AGUA_TOTAL: total,
	AGUA_ACTUAL: actual
});

describe('water', () => {
	it('suma todos los embalses por semana y calcula el % de España y de cada cuenca', async () => {
		rows.length = 0;
		rows.push(
			row('Ebro', '2025-10-14', 100, 60),
			row('Tajo', '2025-10-14', 100, 40),
			row('Ebro', '2026-10-13', 100, 70),
			row('Tajo', '2026-10-13', 300, 90)
		);
		mockFetch(() => new Response(new Uint8Array([1])));
		const data = await water.fetch(undefined);
		expect(data).toMatchObject({ date: '2026-10-13', hm3: 160, capacity: 400, pct: 40, yearAgo: 50 });
		expect(data.history.map((p) => p.t)).toEqual(['2025-10-14', '2026-10-13']);
		// De menos a más llena.
		expect(data.basins).toEqual([
			{ name: 'Tajo', hm3: 90, capacity: 300, pct: 30 },
			{ name: 'Ebro', hm3: 70, capacity: 100, pct: 70 }
		]);
	});
});
