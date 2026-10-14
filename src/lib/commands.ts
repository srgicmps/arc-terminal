// Comandos de la barra: cada uno abre una vista. El orden es el de las teclas de función.

export interface Command {
	code: string;
	/** Ruta de SvelteKit. */
	route:
		| '/'
		| '/eco'
		| '/geo'
		| '/es'
		| '/ws'
		| '/tech'
		| '/ai'
		| '/boe'
		| '/usgov'
		| '/luz'
		| '/wx'
		| '/fuel'
		| '/cal'
		| '/wiki'
		| '/news'
		| '/help'
		| '/status';
	/** Nombre corto para la tecla. */
	key: string;
	/** Qué abre, para las sugerencias y la ayuda. */
	desc: string;
	sources: string;
	/** Si sale en la fila de teclas de función. */
	pinned?: boolean;
}

export const COMMANDS: Command[] = [
	{ code: 'TOP', route: '/', key: 'Portada', desc: 'Portada: lo más importante de cada sección', sources: 'Todas', pinned: true },
	{ code: 'ECO', route: '/eco', key: 'Economía', desc: 'Economía y macro: paro, inflación, PIB, tipos', sources: 'Eurostat, BCE, BLS, Tesoro de EE. UU., El País, Expansión, FT', pinned: true },
	{ code: 'GEO', route: '/geo', key: 'Geopolítica', desc: 'Geopolítica y terremotos', sources: 'BBC, Al Jazeera, DW, France 24, The Guardian, GDELT, USGS', pinned: true },
	{ code: 'ES', route: '/es', key: 'España', desc: 'España: actualidad, BOE y luz', sources: 'El País, RTVE, elDiario.es, El Mundo, Europa Press, BOE, REE', pinned: true },
	{ code: 'WS', route: '/ws', key: 'Wall Street', desc: 'Wall Street: mapa de calor, curva de tipos, divisas y cripto', sources: 'TradingView, Tesoro de EE. UU., BCE, CoinGecko, CNBC, WSJ', pinned: true },
	{ code: 'TECH', route: '/tech', key: 'Tecnología', desc: 'Tecnología y Hacker News', sources: 'Hacker News, TechCrunch, The Verge, Ars Technica, Xataka, Wired', pinned: true },
	{ code: 'AI', route: '/ai', key: 'IA', desc: 'Inteligencia artificial', sources: 'MIT Technology Review, Hugging Face, OpenAI, Google, The Verge', pinned: true },
	{ code: 'BOE', route: '/boe', key: 'BOE', desc: 'Sumario del Boletín Oficial del Estado de hoy', sources: 'API de datos abiertos del BOE', pinned: true },
	{ code: 'USGOV', route: '/usgov', key: 'Gob. EE. UU.', desc: 'Federal Register: decretos presidenciales y normas de EE. UU.', sources: 'Federal Register, Casa Blanca, Reserva Federal' },
	{ code: 'LUZ', route: '/luz', key: 'Luz', desc: 'Precio de la luz hora a hora, hoy y mañana', sources: 'Red Eléctrica (REE)', pinned: true },
	{ code: 'WX', route: '/wx', key: 'Tiempo', desc: 'Tiempo en Menorca y otras ciudades', sources: 'Open-Meteo' },
	{ code: 'FUEL', route: '/fuel', key: 'Gasolina', desc: 'Gasolineras más baratas de Menorca', sources: 'Ministerio para la Transición Ecológica', pinned: true },
	{ code: 'NEWS', route: '/news', key: 'Buscar', desc: 'Buscador en todos los titulares de todas las secciones', sources: 'Todos los medios' },
	{ code: 'WIKI', route: '/wiki', key: 'Wikipedia', desc: 'Lo más leído en Wikipedia y efemérides del día', sources: 'Wikipedia en español' },
	{ code: 'CAL', route: '/cal', key: 'Agenda', desc: 'Agenda económica de la semana', sources: 'TradingView' },
	{ code: 'STATUS', route: '/status', key: 'Fuentes', desc: 'Estado de todas las fuentes de datos', sources: 'Arc Terminal' },
	{ code: 'HELP', route: '/help', key: 'Ayuda', desc: 'Comandos y atajos de teclado', sources: '' }
];

/** Valores populares para sugerir en la barra (se abren con la ficha de TradingView). */
export const TICKERS: { code: string; name: string; tv: string }[] = [
	{ code: 'NVDA', name: 'NVIDIA', tv: 'NASDAQ:NVDA' },
	{ code: 'AAPL', name: 'Apple', tv: 'NASDAQ:AAPL' },
	{ code: 'MSFT', name: 'Microsoft', tv: 'NASDAQ:MSFT' },
	{ code: 'GOOGL', name: 'Alphabet', tv: 'NASDAQ:GOOGL' },
	{ code: 'AMZN', name: 'Amazon', tv: 'NASDAQ:AMZN' },
	{ code: 'META', name: 'Meta', tv: 'NASDAQ:META' },
	{ code: 'TSLA', name: 'Tesla', tv: 'NASDAQ:TSLA' },
	{ code: 'AVGO', name: 'Broadcom', tv: 'NASDAQ:AVGO' },
	{ code: 'TSM', name: 'TSMC', tv: 'NYSE:TSM' },
	{ code: 'ASML', name: 'ASML', tv: 'NASDAQ:ASML' },
	{ code: 'AMD', name: 'AMD', tv: 'NASDAQ:AMD' },
	{ code: 'NFLX', name: 'Netflix', tv: 'NASDAQ:NFLX' },
	{ code: 'BRK.B', name: 'Berkshire Hathaway', tv: 'NYSE:BRK.B' },
	{ code: 'JPM', name: 'JPMorgan', tv: 'NYSE:JPM' },
	{ code: 'SPY', name: 'S&P 500 (ETF)', tv: 'AMEX:SPY' },
	{ code: 'QQQ', name: 'Nasdaq 100 (ETF)', tv: 'NASDAQ:QQQ' },
	{ code: 'SAN', name: 'Banco Santander', tv: 'BME:SAN' },
	{ code: 'ITX', name: 'Inditex', tv: 'BME:ITX' },
	{ code: 'IBE', name: 'Iberdrola', tv: 'BME:IBE' },
	{ code: 'BBVA', name: 'BBVA', tv: 'BME:BBVA' },
	{ code: 'TEF', name: 'Telefónica', tv: 'BME:TEF' },
	{ code: 'IBEX', name: 'IBEX 35', tv: 'BME:IBC' },
	{ code: 'SPX', name: 'S&P 500', tv: 'SP:SPX' },
	{ code: 'NDX', name: 'Nasdaq 100', tv: 'NASDAQ:NDX' },
	{ code: 'DAX', name: 'DAX', tv: 'XETR:DAX' },
	{ code: 'BTC', name: 'Bitcoin', tv: 'BITSTAMP:BTCUSD' },
	{ code: 'ETH', name: 'Ethereum', tv: 'BITSTAMP:ETHUSD' },
	{ code: 'GOLD', name: 'Oro', tv: 'TVC:GOLD' },
	{ code: 'BRENT', name: 'Petróleo Brent', tv: 'TVC:UKOIL' },
	{ code: 'EURUSD', name: 'Euro / dólar', tv: 'FX:EURUSD' }
];

/** Símbolo de TradingView para lo que escriba Sergi: un valor conocido o el texto tal cual. */
export function tvSymbol(code: string): string {
	const upper = code.trim().toUpperCase();
	return TICKERS.find((t) => t.code === upper)?.tv ?? upper;
}
