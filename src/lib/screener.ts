// EQS: buscador de acciones con el widget «screener» de TradingView (sin clave). El widget trae su propia barra
// de filtros (sector, PER, dividendo, subida…); aquí se eligen la bolsa, el punto de partida y las columnas.
// Los valores (`market`, `defaultScreen`, `defaultColumn`) son los del configurador de TradingView.

export const MARKETS = [
	{ value: 'america', label: 'EE. UU.' },
	{ value: 'germany', label: 'Alemania' },
	{ value: 'spain', label: 'España' },
	{ value: 'france', label: 'Francia' },
	{ value: 'uk', label: 'Reino Unido' },
	{ value: 'japan', label: 'Japón' }
] as const;

export const SCREENS = [
	{ value: 'most_capitalized', label: 'Más grandes' },
	{ value: 'top_gainers', label: 'Suben' },
	{ value: 'top_losers', label: 'Bajan' },
	{ value: 'volume_leaders', label: 'Más negociadas' },
	{ value: 'high_dividend', label: 'Dividendo alto' },
	{ value: 'overbought', label: 'Sobrecompradas' },
	{ value: 'oversold', label: 'Sobrevendidas' }
] as const;

export const COLUMNS = [
	{ value: 'overview', label: 'Resumen' },
	{ value: 'performance', label: 'Rentabilidad' },
	{ value: 'valuation', label: 'Valoración' },
	{ value: 'dividends', label: 'Dividendos' },
	{ value: 'oscillators', label: 'Técnico' }
] as const;

export type Market = (typeof MARKETS)[number]['value'];
export type Screen = (typeof SCREENS)[number]['value'];
export type Column = (typeof COLUMNS)[number]['value'];

const isIn = (list: readonly { value: string }[]) => (v: string) => list.some((o) => o.value === v);
export const isMarket = isIn(MARKETS);
export const isScreen = isIn(SCREENS);
export const isColumn = isIn(COLUMNS);

/** Configuración del widget, con su barra de filtros. */
export const screenerConfig = (market: Market, screen: Screen, column: Column) => ({
	market,
	defaultScreen: screen,
	defaultColumn: column,
	showToolbar: true,
	isTransparent: false
});
