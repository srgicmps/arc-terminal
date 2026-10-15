// Clima del planeta: lectura de los CSV de ERA5 y de Mauna Loa, puesto del día y CO₂ de hace un año.
import { describe, expect, it } from 'vitest';
import { parseCo2, parseEra5, parseOni, rankDay, summarizeCo2, summarizeEnso, summarizeTemp, yearAgo } from './climate.ts';

const ERA5 = `# Copernicus Climate Change Service
# Global daily surface air temperature
date,2t,clim_91-20,ano_91-20,status
1940-10-12,13.80,14.10,-0.30,final
1941-10-12,13.95,14.10,-0.15,final
2024-10-12,15.20,14.10,1.10,final
2025-10-11,15.00,14.08,0.92,final
2025-10-12,15.10,14.10,1.00,preliminary
2025-10-13,,14.11,,preliminary
`;

describe('ERA5', () => {
	const days = parseEra5(ERA5);

	it('lee las columnas por su nombre y salta las filas sin dato', () => {
		expect(days).toHaveLength(5);
		expect(days.at(-1)).toEqual({ date: '2025-10-12', temp: 15.1, anomaly: 1 });
	});

	it('puesto entre el mismo día de todos los años', () => {
		expect(rankDay(days, '2025-10-12')).toEqual({ rank: 2, years: 4 });
		expect(rankDay(days, '2024-10-12')).toEqual({ rank: 1, years: 4 });
		expect(rankDay(days, '1999-01-01')).toBeNull();
	});

	it('resumen del último día', () => {
		const t = summarizeTemp(days);
		expect(t).toMatchObject({ date: '2025-10-12', rank: 2, years: 4, since: 1940 });
		expect(summarizeTemp([])).toBeNull();
	});

	it('sin cabecera, por posición', () => {
		expect(parseEra5('1940-01-01,12.5,13,-0.5,FINAL\nbasura,1,2,3')).toEqual([{ date: '1940-01-01', temp: 12.5, anomaly: -0.5 }]);
	});
});

const CO2 = `# NOAA GML Mauna Loa daily
# year, month, day, decimal, value
2025,10,9,2025.7712,423.10
2025,10,10,2025.7740,-999.99
2026,10,10,2026.7740,426.40
2026,10,12,2026.7795,426.85
`;

describe('CO₂ de Mauna Loa', () => {
	const days = parseCo2(CO2);

	it('lee las filas y salta los días sin medida', () => {
		expect(days.map((d) => d.date)).toEqual(['2025-10-09', '2026-10-10', '2026-10-12']);
	});

	it('el mismo día de hace un año o el más cercano', () => {
		expect(yearAgo(days, '2026-10-12')).toEqual({ date: '2025-10-09', ppm: 423.1 });
		expect(yearAgo(days, '2026-10-12', 2)).toBeNull();
	});

	it('resumen de la última medida', () => {
		expect(summarizeCo2(days)).toEqual({ date: '2026-10-12', ppm: 426.85, yearAgo: { date: '2025-10-09', ppm: 423.1 } });
		expect(summarizeCo2([])).toBeNull();
	});
});

describe('El Niño (ONI)', () => {
	const txt = [
		' SEAS  YR   TOTAL   ANOM',
		' ASO 2025  26.14  -0.57',
		' SON 2025  26.10  -0.61',
		' OND 2025  26.04  -0.61',
		' NDJ 2025  26.10  -0.55',
		' DJF 2026  26.15  -0.52',
		' JFM 2026  26.57  -0.21',
		' FMA 2026  27.40   0.20',
		' MAM 2026  28.09   0.55',
		' AMJ 2026  28.30   0.62'
	].join('\n');

	it('lee los trimestres y da la fase del último y cuántos lleva seguidos', () => {
		const seasons = parseOni(txt);
		expect(seasons).toHaveLength(9);
		expect(seasons[0]).toEqual({ season: 'ASO', year: 2025, anom: -0.57 });
		expect(summarizeEnso(seasons)).toEqual({ season: 'AMJ', year: 2026, anom: 0.62, phase: 'nino', streak: 2 });
		expect(summarizeEnso(seasons.slice(0, 5))).toMatchObject({ phase: 'nina', streak: 5 });
		expect(summarizeEnso(seasons.slice(0, 7))).toMatchObject({ phase: 'neutral', streak: 2 });
		expect(summarizeEnso([])).toBeNull();
	});
});
