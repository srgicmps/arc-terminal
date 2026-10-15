// Mapas de calor de TradingView (widget «stock-heatmap», sin clave) para IMAP: un índice o todas las acciones
// de un país, agrupadas por sector y del tamaño de su capitalización. Los `dataSource` son los del
// configurador de TradingView; se comprueba que cargan con scripts/tv-shots.ts (Action, herramienta tv-shots).

export interface HeatMap {
	key: string;
	label: string;
	dataSource: string;
	/** Índice («index») o todas las acciones de un país («country»). */
	kind: 'index' | 'country';
}

export const HEATMAPS: readonly HeatMap[] = [
	{ key: 'spx', label: 'S&P 500', dataSource: 'SPX500', kind: 'index' },
	{ key: 'ndx', label: 'Nasdaq 100', dataSource: 'NASDAQ100', kind: 'index' },
	{ key: 'dji', label: 'Dow Jones', dataSource: 'DJDJI', kind: 'index' },
	{ key: 'dax', label: 'DAX', dataSource: 'DAX', kind: 'index' },
	{ key: 'ibex', label: 'IBEX 35', dataSource: 'IBEX35', kind: 'index' },
	{ key: 'cac', label: 'CAC 40', dataSource: 'CAC40', kind: 'index' },
	{ key: 'ftse', label: 'FTSE 100', dataSource: 'FTSE100', kind: 'index' },
	{ key: 'nikkei', label: 'Nikkei 225', dataSource: 'NI225', kind: 'index' },
	{ key: 'us', label: 'EE. UU. (todas)', dataSource: 'AllUSA', kind: 'country' },
	{ key: 'de', label: 'Alemania (todas)', dataSource: 'AllDE', kind: 'country' },
	{ key: 'es', label: 'España (todas)', dataSource: 'AllES', kind: 'country' },
	{ key: 'jp', label: 'Japón (todas)', dataSource: 'AllJP', kind: 'country' }
];

export const isHeatMap = (v: string) => HEATMAPS.some((m) => m.key === v);

/** Configuración del widget: por sector, del tamaño de la capitalización y coloreado por la variación del día. */
export function heatmapConfig(map: HeatMap) {
	return {
		dataSource: map.dataSource,
		grouping: 'sector',
		blockSize: 'market_cap_basic',
		blockColor: 'change',
		hasTopBar: false,
		isDataSetEnabled: false,
		isZoomEnabled: true,
		hasSymbolTooltip: true,
		isMonoSize: false
	};
}

/** Los 11 sectores del S&P 500, con sus fondos cotizados (Select Sector SPDR). */
export const SECTORS = [
	{ name: 'AMEX:XLK', displayName: 'Tecnología' },
	{ name: 'AMEX:XLC', displayName: 'Comunicaciones' },
	{ name: 'AMEX:XLY', displayName: 'Consumo discrecional' },
	{ name: 'AMEX:XLP', displayName: 'Consumo básico' },
	{ name: 'AMEX:XLF', displayName: 'Financiero' },
	{ name: 'AMEX:XLV', displayName: 'Salud' },
	{ name: 'AMEX:XLI', displayName: 'Industria' },
	{ name: 'AMEX:XLE', displayName: 'Energía' },
	{ name: 'AMEX:XLB', displayName: 'Materiales' },
	{ name: 'AMEX:XLRE', displayName: 'Inmobiliario' },
	{ name: 'AMEX:XLU', displayName: 'Servicios públicos' }
];

/**
 * Un índice de referencia por país. Los índices de contado (TVC:SX5E, TVC:NI225) salen vacíos en los widgets:
 * van los CFD de FOREX.com y OANDA, como en WS.
 */
export const WORLD = [
	{ name: 'FOREXCOM:SPXUSD', displayName: 'EE. UU. · S&P 500' },
	{ name: 'OANDA:EU50EUR', displayName: 'Zona euro · Euro Stoxx 50' },
	{ name: 'XETR:DAX', displayName: 'Alemania · DAX' },
	{ name: 'OANDA:FR40EUR', displayName: 'Francia · CAC 40' },
	{ name: 'OANDA:UK100GBP', displayName: 'Reino Unido · FTSE 100' },
	{ name: 'BME:IBC', displayName: 'España · IBEX 35' },
	{ name: 'OANDA:NL25EUR', displayName: 'Países Bajos · AEX' },
	{ name: 'OANDA:CH20CHF', displayName: 'Suiza · SMI' },
	{ name: 'OANDA:JP225USD', displayName: 'Japón · Nikkei 225' },
	{ name: 'OANDA:HK33HKD', displayName: 'Hong Kong · Hang Seng' },
	{ name: 'OANDA:CN50USD', displayName: 'China · A50' },
	{ name: 'OANDA:IN50USD', displayName: 'India · Nifty 50' },
	{ name: 'OANDA:AU200AUD', displayName: 'Australia · ASX 200' }
];
