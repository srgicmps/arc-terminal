// Gasto militar del SIPRI: nombres de país, hojas de años y la tabla del último año.
import { describe, expect, it } from 'vitest';
import { countryCode, parseMilex, yearTable } from './milex.ts';

const sheet = (name: string, rows: unknown[][]) => ({
	name,
	cells: [['Military expenditure by country'], [], ['Country', 'Notes', 2023, 2024, 2025], ['Africa'], ...rows]
});

describe('SIPRI', () => {
	it('nombres del SIPRI → ISO', () => {
		expect(countryCode('United States of America')).toBe('US');
		expect(countryCode('Russia')).toBe('RU');
		expect(countryCode('Korea, South')).toBe('KR');
		expect(countryCode('Türkiye')).toBe('TR');
		expect(countryCode('Spain')).toBe('ES');
		expect(countryCode('United Kingdom')).toBe('GB');
		expect(countryCode('Saudi Arabia')).toBe('SA');
		expect(countryCode('Atlantis')).toBeNull();
	});

	it('hoja de años: salta «...» y «xxx» y las filas de región', () => {
		const t = yearTable(sheet('x', [['Spain', 89, 19000, '...', 'xxx']]).cells);
		expect(t.years).toEqual([2023, 2024, 2025]);
		expect([...t.values.keys()]).toEqual(['Spain']);
		expect(t.values.get('Spain')?.get(2023)).toBe(19000);
	});

	it('último año, puesto, % del PIB y variación real', () => {
		const data = parseMilex([
			sheet('Current US$', [
				['United States of America', 44, 900000, 950000, 1000000],
				['Spain', 89, 20000, 22000, 25000],
				['Atlantis', '', 100, 200, 300],
				['Russia', 83, 'xxx', 150000, '...']
			]),
			sheet('Constant (2024) US$', [['Spain', 89, 21000, 22000, 24200]]),
			// Un valor por encima de 1 (datos raros) no cambia la escala: manda la mediana.
			sheet('Share of GDP', [
				['Spain', 89, 0.012, 0.013, 0.0145],
				['Atlantis', '', 1.2, 1.3, 1.4],
				['United States of America', 44, 0.03, 0.03, 0.031]
			])
		]);
		expect(data?.year).toBe(2025);
		expect(data?.rows.map((r) => [r.rank, r.code, r.name])).toEqual([
			[1, 'US', 'Estados Unidos'],
			[2, 'ES', 'España'],
			[3, null, 'Atlantis']
		]);
		expect(data?.rows[1]).toMatchObject({ usd: 25000, gdp: 1.45, real: 10 });
		expect(data?.rows[0]).toMatchObject({ gdp: 3.1, real: null });
	});

	it('sin la hoja en dólares corrientes, null', () => {
		expect(parseMilex([sheet('Share of GDP', [])])).toBeNull();
	});
});
