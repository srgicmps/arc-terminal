// Ayudantes pequeños de src/lib: series, tiempo y comandos.
import { describe, expect, it } from 'vitest';
import { COMMANDS, TICKERS, tvSymbol } from './commands.ts';
import { at, change, last, seriesMap, spread } from './series.ts';
import type { Series } from './types.ts';
import { compass, sky } from './weather.ts';

const serie = (id: string, points: [string, number][]): Series => ({
	id,
	label: id,
	unit: '%',
	geo: 'ES',
	points: points.map(([t, v]) => ({ t, v })),
	source: 'Test',
	url: 'https://example.org'
});

describe('series', () => {
	const es = serie('bond10-es', [['2026-07', 3.2], ['2026-08', 3.1], ['2026-09', 3.0]]);
	const de = serie('bond10-de', [['2026-08', 2.6], ['2026-09', 2.55]]);

	it('seriesMap junta varios archivos y busca por id', () => {
		const dataset = (series: Series[]) => ({ name: 'x', fetchedAt: '', data: { series } });
		const get = seriesMap(dataset([es]), null, dataset([de]));
		expect(get('bond10-es')).toBe(es);
		expect(get('bond10-de')).toBe(de);
		expect(get('nada')).toBeUndefined();
	});

	it('last y at', () => {
		expect(last(es)).toEqual({ t: '2026-09', v: 3.0 });
		expect(last(undefined)).toBeUndefined();
		expect(at(es, '2026-08-15')).toEqual({ t: '2026-08', v: 3.1 });
		expect(at(es, '2026-01')).toBeUndefined();
		expect(at(undefined, '2026-08')).toBeUndefined();
	});

	it('spread: prima de riesgo en puntos básicos con los periodos comunes', () => {
		const s = spread(es, de, 'spread-es', 'Prima de riesgo')!;
		expect(s.unit).toBe('pb');
		expect(s.points).toEqual([
			{ t: '2026-08', v: 50 },
			{ t: '2026-09', v: 45 }
		]);
		expect(spread(es, undefined, 'x', 'x')).toBeUndefined();
	});

	it('change: variación porcentual', () => {
		expect(change(es)).toBeCloseTo(-3.2258, 3);
		expect(change(es, 2)).toBeCloseTo(-6.25, 5);
		expect(change(es, 3)).toBeNull();
		expect(change(serie('z', [['a', 0], ['b', 1]]))).toBeNull();
		expect(change(undefined)).toBeNull();
	});
});

describe('weather', () => {
	it('sky traduce los códigos de la OMM', () => {
		expect(sky(0)).toEqual({ label: 'Despejado', icon: '☀' });
		expect(sky(63).label).toBe('Lluvia');
		expect(sky(99).label).toBe('Tormenta');
		expect(sky(42)).toEqual({ label: '—', icon: '·' });
	});

	it('compass da el punto cardinal de donde sopla el viento', () => {
		expect(compass(0)).toBe('N');
		expect(compass(340)).toBe('N');
		expect(compass(90)).toBe('E');
		expect(compass(225)).toBe('SO');
		expect(compass(360)).toBe('N');
		expect(compass(NaN)).toBe('');
	});
});

describe('commands', () => {
	it('los códigos y las rutas no se repiten', () => {
		const codes = COMMANDS.map((c) => c.code);
		expect(new Set(codes).size).toBe(codes.length);
		expect(new Set(COMMANDS.map((c) => c.route)).size).toBe(COMMANDS.length);
		expect(new Set(TICKERS.map((t) => t.code)).size).toBe(TICKERS.length);
	});

	it('tvSymbol traduce los valores conocidos y deja el resto en mayúsculas', () => {
		expect(tvSymbol('nvda')).toBe('NASDAQ:NVDA');
		expect(tvSymbol(' ibex ')).toBe('BME:IBC');
		expect(tvSymbol('nyse:ko')).toBe('NYSE:KO');
	});
});
