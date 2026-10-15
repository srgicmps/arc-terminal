import { describe, expect, it } from 'vitest';
import { COLUMNS, isColumn, isMarket, isScreen, MARKETS, SCREENS, screenerConfig } from './screener.ts';

describe('buscador de acciones (EQS)', () => {
	it('opciones sin repetir y validación de la URL', () => {
		for (const list of [MARKETS, SCREENS, COLUMNS]) expect(new Set(list.map((o) => o.value)).size).toBe(list.length);
		expect(isMarket('spain')).toBe(true);
		expect(isScreen('top_gainers')).toBe(true);
		expect(isColumn('dividends')).toBe(true);
		expect(isMarket('marte')).toBe(false);
	});

	it('pasa la bolsa, el punto de partida y las columnas al widget, con su barra de filtros', () => {
		expect(screenerConfig('spain', 'high_dividend', 'dividends')).toMatchObject({
			market: 'spain',
			defaultScreen: 'high_dividend',
			defaultColumn: 'dividends',
			showToolbar: true
		});
	});
});
