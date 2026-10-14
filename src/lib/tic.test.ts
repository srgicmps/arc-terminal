import { describe, expect, it } from 'vitest';
import { parseTic } from './tic.ts';

const TXT = `Table 5: Major Foreign Holders of Treasury Securities
Holdings at end of time period
Billions of dollars

Country                  2026-07   2026-06   2026-05
Japan                     1103.9    1116.7    1143.1
China, Mainland            618.0     633.4     659.3
Korea, South               131.5     134.7     132.3
All Other                 1842.4    1850.3    1859.6
Grand Total               9248.1    9298.5    9368.5
Of Which: Foreign Official  3773.1  3778.1    3845.9
Of Which: Foreign Official Treasury Bills  354.4  360.6  396.2

Notes: The data in this table are collected primarily from U.S.-based custodians 2026 1.0`;

describe('TIC, tabla 5', () => {
	it('lee los meses, los países con comas y los totales', () => {
		const d = parseTic(TXT)!;
		expect(d.months).toEqual(['2026-05', '2026-06', '2026-07']);
		expect(d.holders.map((h) => h.name)).toEqual(['Japón', 'China', 'Corea del Sur']);
		expect(d.holders[0].values).toEqual([1143.1, 1116.7, 1103.9]);
		expect(d.total.at(-1)).toBe(9248.1);
		expect(d.official.at(-1)).toBe(3773.1);
	});

	it('sin cabecera de meses no devuelve nada', () => {
		expect(parseTic('Japan 1 2 3')).toBeNull();
	});
});
