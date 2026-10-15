// SEPE: paro registrado por municipio, sumado por comunidad, con variación mensual y anual.
import { describe, expect, it } from 'vitest';
import { buildParo, sumCsv } from '../sources/paro.ts';

const head = [
	';;;;PARO REGISTRADO POR MUNICIPIOS DESGLOSADO POR SEXO, TRAMOS DE EDAD Y SECTOR;;;;',
	'Código mes ;mes;Código de CA;Comunidad Autónoma;Codigo Provincia;Provincia;Codigo Municipio; Municipio;total Paro Registrado;Paro hombre edad < 25'
];
const row = (month: string, ca: number, total: string) => `${month};Mes;${ca};CA;4;Prov;04001;Muni;${total};0`;

describe('sumCsv y buildParo', () => {
	it('suma los municipios de cada comunidad, cuenta «<5» como 2 y calcula las variaciones', () => {
		const lastYear = [...head, row('202509', 1, '1100'), row('202509', 4, '50')].join('\r\n');
		const thisYear = [
			...head,
			row('202608', 1, '1000'),
			row('202608', 4, '40'),
			row('202609', 1, '900'),
			row('202609', 1, '<5'),
			row('202609', 1, '98'),
			row('202609', 4, '60')
		].join('\n');
		const data = buildParo(sumCsv(thisYear, sumCsv(lastYear)))!;
		expect(data.month).toBe('2026-09');
		expect(data.regions).toEqual([
			{ code: 1, name: 'Andalucía', value: 1000, mom: 0, yoy: -9.1 },
			{ code: 4, name: 'Baleares', value: 60, mom: 50, yoy: 20 }
		]);
		expect(data.national).toEqual([
			{ t: '2025-09', v: 1150 },
			{ t: '2026-08', v: 1040 },
			{ t: '2026-09', v: 1060 }
		]);
	});

	it('sin filas no da datos', () => {
		expect(buildParo(sumCsv(head.join('\n')))).toBeNull();
	});
});
