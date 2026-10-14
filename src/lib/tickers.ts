// Valores que la terminal conoce: se sugieren en la barra y abren su ficha (/s?sym=…).
// Los usan también los scripts de Node (news-index, search, sec), así que este archivo no puede usar
// nada de Vite (import.meta.glob).

/** Un valor que la terminal conoce. */
export interface Ticker {
	code: string;
	name: string;
	/** Símbolo de TradingView. */
	tv: string;
	/**
	 * CIK de la SEC (10 dígitos con ceros): solo en las empresas que cotizan en EE. UU. y presentan
	 * documentos en la SEC. Con él, scripts/sources/sec.ts descarga sus últimos documentos.
	 */
	cik?: string;
	/**
	 * Otros nombres con los que sale en las noticias («Zara» para Inditex). Junto con `name`, sirven para
	 * encontrar los titulares que la nombran (src/lib/news.ts → mentions). Si empiezan por mayúscula,
	 * la coincidencia también: así «Meta» no salta con «la meta de déficit».
	 */
	aliases?: string[];
}

/** Valores populares para sugerir en la barra (se abren con la ficha de TradingView). */
export const TICKERS: Ticker[] = [
	{ code: 'NVDA', name: 'NVIDIA', tv: 'NASDAQ:NVDA', cik: '0001045810' },
	{ code: 'AAPL', name: 'Apple', tv: 'NASDAQ:AAPL', cik: '0000320193', aliases: ['iPhone'] },
	{ code: 'MSFT', name: 'Microsoft', tv: 'NASDAQ:MSFT', cik: '0000789019' },
	{ code: 'GOOGL', name: 'Alphabet', tv: 'NASDAQ:GOOGL', cik: '0001652044', aliases: ['Google', 'YouTube', 'Gemini'] },
	{ code: 'AMZN', name: 'Amazon', tv: 'NASDAQ:AMZN', cik: '0001018724', aliases: ['AWS'] },
	{ code: 'META', name: 'Meta', tv: 'NASDAQ:META', cik: '0001326801', aliases: ['Facebook', 'Instagram', 'WhatsApp', 'Zuckerberg'] },
	{ code: 'TSLA', name: 'Tesla', tv: 'NASDAQ:TSLA', cik: '0001318605' },
	{ code: 'AVGO', name: 'Broadcom', tv: 'NASDAQ:AVGO', cik: '0001730168' },
	// TSMC y ASML son extranjeras, pero cotizan en EE. UU. y presentan 6-K y 20-F en la SEC.
	{ code: 'TSM', name: 'TSMC', tv: 'NYSE:TSM', cik: '0001046179', aliases: ['Taiwan Semiconductor'] },
	{ code: 'ASML', name: 'ASML', tv: 'NASDAQ:ASML', cik: '0000937966' },
	{ code: 'AMD', name: 'AMD', tv: 'NASDAQ:AMD', cik: '0000002488' },
	{ code: 'NFLX', name: 'Netflix', tv: 'NASDAQ:NFLX', cik: '0001065280' },
	{ code: 'BRK.B', name: 'Berkshire Hathaway', tv: 'NYSE:BRK.B', cik: '0001067983', aliases: ['Berkshire', 'Warren Buffett'] },
	{ code: 'JPM', name: 'JPMorgan', tv: 'NYSE:JPM', cik: '0000019617', aliases: ['JP Morgan', 'J.P. Morgan', 'Jamie Dimon'] },
	{ code: 'SPY', name: 'S&P 500 (ETF)', tv: 'AMEX:SPY' },
	{ code: 'QQQ', name: 'Nasdaq 100 (ETF)', tv: 'NASDAQ:QQQ' },
	{ code: 'SAN', name: 'Banco Santander', tv: 'BME:SAN', aliases: ['Santander'] },
	{ code: 'ITX', name: 'Inditex', tv: 'BME:ITX', aliases: ['Zara', 'Amancio Ortega'] },
	{ code: 'IBE', name: 'Iberdrola', tv: 'BME:IBE' },
	{ code: 'BBVA', name: 'BBVA', tv: 'BME:BBVA' },
	{ code: 'TEF', name: 'Telefónica', tv: 'BME:TEF', aliases: ['Movistar'] },
	{ code: 'IBEX', name: 'IBEX 35', tv: 'BME:IBC', aliases: ['Ibex'] },
	{ code: 'SPX', name: 'S&P 500', tv: 'SP:SPX' },
	{ code: 'NDX', name: 'Nasdaq 100', tv: 'NASDAQ:NDX', aliases: ['Nasdaq'] },
	{ code: 'DAX', name: 'DAX', tv: 'XETR:DAX' },
	{ code: 'BTC', name: 'Bitcoin', tv: 'BITSTAMP:BTCUSD' },
	{ code: 'ETH', name: 'Ethereum', tv: 'BITSTAMP:ETHUSD', aliases: ['ether'] },
	{ code: 'GOLD', name: 'Oro', tv: 'TVC:GOLD', aliases: ['oro', 'gold'] },
	{ code: 'BRENT', name: 'Petróleo Brent', tv: 'TVC:UKOIL', aliases: ['Brent'] },
	{ code: 'EURUSD', name: 'Euro / dólar', tv: 'FX:EURUSD' },
	// Defensa y geopolítica (src/lib/defense.ts). BAE Systems va como BAES porque BA es Boeing.
	// Todos los símbolos, comprobados con tv-shots en la Action.
	{ code: 'PLTR', name: 'Palantir', tv: 'NASDAQ:PLTR', cik: '0001321655' },
	{ code: 'LMT', name: 'Lockheed Martin', tv: 'NYSE:LMT', cik: '0000936468', aliases: ['Lockheed'] },
	{ code: 'RTX', name: 'Raytheon (RTX)', tv: 'NYSE:RTX', cik: '0000101829' },
	{ code: 'NOC', name: 'Northrop Grumman', tv: 'NYSE:NOC', cik: '0001133421', aliases: ['Northrop'] },
	{ code: 'GD', name: 'General Dynamics', tv: 'NYSE:GD', cik: '0000040533' },
	{ code: 'BA', name: 'Boeing', tv: 'NYSE:BA', cik: '0000012927' },
	{ code: 'LHX', name: 'L3Harris', tv: 'NYSE:LHX', cik: '0000202058', aliases: ['L3Harris Technologies'] },
	{ code: 'ITA', name: 'Aeroespacial y defensa EE. UU. (ETF)', tv: 'AMEX:ITA' },
	{ code: 'AIR', name: 'Airbus', tv: 'EURONEXT:AIR' },
	// La Bolsa de Londres sale vacía en los widgets (LSE:BA.): BAE Systems va con su cotización en Xetra, en euros.
	{ code: 'BAES', name: 'BAE Systems', tv: 'XETR:BSP', aliases: ['BAE'] },
	{ code: 'RHM', name: 'Rheinmetall', tv: 'XETR:RHM' },
	{ code: 'LDO', name: 'Leonardo', tv: 'MIL:LDO', aliases: ['Leonardo SpA'] },
	{ code: 'HO', name: 'Thales', tv: 'EURONEXT:HO' },
	{ code: 'SAAB', name: 'Saab', tv: 'OMXSTO:SAAB_B' },
	{ code: 'IDR', name: 'Indra', tv: 'BME:IDR' }
];

/** Símbolo de TradingView para lo que escriba Sergi: un valor conocido o el texto tal cual. */
export function tvSymbol(code: string): string {
	const upper = code.trim().toUpperCase();
	return TICKERS.find((t) => t.code === upper)?.tv ?? upper;
}
