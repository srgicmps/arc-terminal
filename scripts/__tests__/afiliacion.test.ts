// Seguridad Social (PXWeb): afiliados medios, fila «Total Nacional» del CSV.
import { describe, expect, it } from 'vitest';
import { parseAfiliacion } from '../sources/afiliacion.ts';

const csv = [
	'"Afiliados medios R. General y RE. Autonomos por Periodo, comunidades autónomas, Regímenes y Seccion cnae"',
	'"Periodo";"comunidades autónomas";"Total Regimenes(RG+RETA) TODAS LAS SECCIONES";"Total Regimenes(RG+RETA) A. AGRICULTURA"',
	'"202608";"Total Nacional";21300000.50;700000.00',
	'"202608";"Andalucía";3500000.00;200000.00',
	'"202609";"Total Nacional";21450000.00;710000.00',
	'"202607";"Total Nacional";21250000.00;690000.00'
].join('\r\n');

describe('parseAfiliacion', () => {
	it('se queda con «Total Nacional», en millones y por orden de mes', () => {
		expect(parseAfiliacion(csv)).toEqual([
			{ t: '2026-07', v: 21.25 },
			{ t: '2026-08', v: 21.3000005 },
			{ t: '2026-09', v: 21.45 }
		]);
	});

	it('guarda solo los últimos meses pedidos', () => {
		expect(parseAfiliacion(csv, 2).map((p) => p.t)).toEqual(['2026-08', '2026-09']);
	});

	it('sin filas de total, lista vacía', () => {
		expect(parseAfiliacion('"Periodo";"CCAA"\n"202609";"Andalucía";1')).toEqual([]);
	});
});
