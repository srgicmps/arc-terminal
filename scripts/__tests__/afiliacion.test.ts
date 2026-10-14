// Seguridad Social (PXWeb): afiliados, fila del total («TODAS LAS SECCIONES») del CSV, con historial acumulado.
import { describe, expect, it } from 'vitest';
import { mergeMonths, parseAfiliacion } from '../sources/afiliacion.ts';

const csv = [
	'"Afiliados por Periodo, Seccion cnae, Regímenes y Sexo"',
	'"Periodo";"Seccion cnae";"Total Regimenes(RG+RETA) Total Sexo";"Total Regimenes(RG+RETA) Mujer"',
	'"202608";"TODAS LAS SECCIONES";21018068;9800000',
	'"202608";"A. AGRICULTURA, GANADERÍA, SILVICULTURA Y PESCA";1000000;300000',
	'"202609";"TODAS LAS SECCIONES";21281233;9900000',
	'"202607";"TODAS LAS SECCIONES";21216177;9850000'
].join('\r\n');

describe('parseAfiliacion', () => {
	it('se queda con el total, en millones y por orden de mes', () => {
		expect(parseAfiliacion(csv)).toEqual([
			{ t: '2026-07', v: 21.216177 },
			{ t: '2026-08', v: 21.018068 },
			{ t: '2026-09', v: 21.281233 }
		]);
	});

	it('sin filas de total, lista vacía', () => {
		expect(parseAfiliacion('"Periodo";"Seccion cnae"\n"202609";"B. INDUSTRIAS EXTRACTIVAS";1')).toEqual([]);
	});
});

describe('mergeMonths', () => {
	it('suma los meses nuevos al historial, manda el dato nuevo y recorta', () => {
		const old = [{ t: '2025-12', v: 20.7 }, { t: '2026-01', v: 20.4 }];
		const fresh = [{ t: '2026-01', v: 20.5 }, { t: '2026-02', v: 20.6 }];
		expect(mergeMonths(old, fresh)).toEqual([{ t: '2025-12', v: 20.7 }, { t: '2026-01', v: 20.5 }, { t: '2026-02', v: 20.6 }]);
		expect(mergeMonths(old, fresh, 2).map((p) => p.t)).toEqual(['2026-01', '2026-02']);
	});
});
