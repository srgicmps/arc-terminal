// Comandos de la barra: cada uno abre una vista. El orden es el de las teclas de función.

export interface Command {
	code: string;
	/** Ruta de SvelteKit. */
	route:
		| '/'
		| '/imp'
		| '/eco'
		| '/geo'
		| '/es'
		| '/ws'
		| '/tech'
		| '/ai'
		| '/boe'
		| '/usgov'
		| '/lider'
		| '/luz'
		| '/agua'
		| '/wx'
		| '/port'
		| '/fuel'
		| '/cal'
		| '/wiki'
		| '/news'
		| '/pais'
		| '/mis'
		| '/fondos'
		| '/help'
		| '/doc'
		| '/status'
		| '/chess'
		| '/tv'
		| '/novedades';
	/** Nombre corto para la tecla. */
	key: string;
	/** Qué abre, para las sugerencias y la ayuda. */
	desc: string;
	sources: string;
	/** Si sale en la fila de teclas de función. */
	pinned?: boolean;
	/** Otras formas de pedirlo, en español (se comparan sin tildes ni mayúsculas). */
	aliases?: string[];
	/**
	 * Si acepta un texto detrás («NEWS inflación»): el parámetro de la URL que lo recibe
	 * (/news?q=inflación), qué hace con él y un ejemplo para la ayuda.
	 */
	arg?: { param: string; label: string; example: string };
}

export const COMMANDS: Command[] = [
	{ code: 'TOP', route: '/', key: 'Portada', desc: 'Portada: lo más importante de cada sección', sources: 'Todas', pinned: true },
	{ code: 'IMP', route: '/imp', key: 'Importante', desc: 'Lo más importante de hoy, la semana, el mes y el año (sin IA)', sources: 'Todos los titulares, BOE, Federal Register, Wikipedia', pinned: true, aliases: ['importante', 'destacado'] },
	{ code: 'ECO', route: '/eco', key: 'Economía', desc: 'Economía y macro: paro, inflación, PIB, tipos', sources: 'Eurostat, BCE, BLS, Tesoro de EE. UU., El País, Expansión, FT', pinned: true },
	{ code: 'GEO', route: '/geo', key: 'Geopolítica', desc: 'Geopolítica, terremotos y elecciones', sources: 'BBC, Al Jazeera, DW, France 24, The Guardian, USGS, Wikidata', pinned: true },
	{ code: 'ES', route: '/es', key: 'España', desc: 'España: actualidad, BOE y luz', sources: 'El País, RTVE, elDiario.es, El Mundo, Europa Press, BOE, REE', pinned: true, aliases: ['españa'] },
	{ code: 'WS', route: '/ws', key: 'Wall Street', desc: 'Wall Street: mapa de calor, curva de tipos, divisas y cripto', sources: 'TradingView, Tesoro de EE. UU., BCE, CoinGecko, CNBC, WSJ', pinned: true, aliases: ['bolsa', 'wall street'] },
	{ code: 'TECH', route: '/tech', key: 'Tecnología', desc: 'Tecnología y Hacker News', sources: 'Hacker News, TechCrunch, The Verge, Ars Technica, Xataka, Wired', pinned: true },
	{ code: 'AI', route: '/ai', key: 'IA', desc: 'Inteligencia artificial', sources: 'MIT Technology Review, Hugging Face, OpenAI, Google, The Verge', pinned: true },
	{ code: 'BOE', route: '/boe', key: 'BOE', desc: 'Sumario del Boletín Oficial del Estado de hoy', sources: 'API de datos abiertos del BOE', pinned: true, aliases: ['boletín'], arg: { param: 'q', label: 'Buscar en el BOE de hoy', example: 'BOE vivienda' } },
	{ code: 'USGOV', route: '/usgov', key: 'Gob. EE. UU.', desc: 'Federal Register: decretos presidenciales y normas de EE. UU.', sources: 'Federal Register, Casa Blanca, Reserva Federal' },
	{ code: 'LIDER', route: '/lider', key: 'Líderes', desc: 'Qué hacen ahora Sánchez, Trump y Lagarde: agenda de hoy y lo último', sources: 'La Moncloa, Roll Call Factba.se, Casa Blanca, Federal Register, BCE', aliases: ['líderes', 'sánchez', 'trump', 'lagarde'] },
	{ code: 'LUZ', route: '/luz', key: 'Luz', desc: 'Precio de la luz hora a hora, hoy y mañana', sources: 'Red Eléctrica (REE)', pinned: true, aliases: ['electricidad', 'pvpc'] },
	{ code: 'AGUA', route: '/agua', key: 'Agua', desc: 'Reservas de agua: embalses de España y sequía en Europa', sources: 'MITECO, Copernicus (European Drought Observatory)', aliases: ['embalses', 'sequía', 'sequia'] },
	{ code: 'WX', route: '/wx', key: 'Tiempo', desc: 'Tiempo, aire y sol en tu sitio y otras ciudades', sources: 'Open-Meteo', aliases: ['tiempo', 'clima', 'lugar', 'sitio'], arg: { param: 'buscar', label: 'Cambiar tu sitio', example: 'LUGAR Tokio' } },
	{ code: 'PORT', route: '/port', key: 'Puertos', desc: 'Barcos en puertos y estrechos (Gibraltar, Róterdam, Singapur, Maó…) con AIS en directo', sources: 'aisstream.io', aliases: ['barcos', 'puertos', 'ais'] },
	{ code: 'MIS', route: '/mis', key: 'Mis valores', desc: 'Tu lista de valores, con cotización en directo', sources: 'TradingView', pinned: true },
	{ code: 'FUEL', route: '/fuel', key: 'Gasolina', desc: 'Gasolineras más baratas de Menorca', sources: 'Ministerio para la Transición Ecológica', pinned: true, aliases: ['gasolina', 'diésel', 'carburante'], arg: { param: 'zona', label: 'Provincia (nombre o número)', example: 'FUEL Madrid' } },
	{ code: 'FONDOS', route: '/fondos', key: 'Fondos', desc: 'Carteras de Berkshire, Pershing Square, Third Point, Bridgewater, ARK y Renaissance: mayores posiciones, compras y ventas', sources: 'SEC EDGAR (13F)', aliases: ['13f', 'carteras', 'buffett'] },
	{ code: 'NEWS', route: '/news', key: 'Buscar', desc: 'Buscador en todos los titulares de todas las secciones', sources: 'Todos los medios', arg: { param: 'q', label: 'Buscar en los titulares', example: 'NEWS inflación' } },
	{ code: 'PAIS', route: '/pais', key: 'País', desc: 'Ficha de un país: PIB, IPC, paro, deuda, tipos, bono, moneda, previsiones del FMI y titulares', sources: 'Eurostat, BLS, FRED, BCE, BIS, Tesoro de EE. UU., FMI, todos los medios', aliases: ['país', 'country'], arg: { param: 'c', label: 'País (nombre o código)', example: 'PAIS Alemania' } },
	{ code: 'WIKI', route: '/wiki', key: 'Wikipedia', desc: 'Lo más leído en Wikipedia y efemérides del día', sources: 'Wikipedia en español' },
	{ code: 'CAL', route: '/cal', key: 'Agenda', desc: 'Agenda económica de la semana', sources: 'TradingView' },
	{ code: 'CHESS', route: '/chess', key: 'Ajedrez', desc: 'Ajedrez contra Stockfish (5 niveles), análisis y problema del día', sources: 'Stockfish, chess.js, Lichess', aliases: ['ajedrez'] },
	{ code: 'TV', route: '/tv', key: 'Modo TV', desc: 'Modo TV: las vistas van rotando solas, a pantalla completa', sources: 'Arc Terminal', aliases: ['tele', 'televisión'], arg: { param: 'tv', label: 'Vistas que rotan', example: 'TV TOP,WS,GEO' } },
	{ code: 'STATUS', route: '/status', key: 'Fuentes', desc: 'Estado de todas las fuentes de datos', sources: 'Arc Terminal' },
	{ code: 'NOVEDADES', route: '/novedades', key: 'Novedades', desc: 'Lo que ha cambiado en Arc Terminal esta semana', sources: 'GitHub (PR fusionados)', aliases: ['cambios', 'changelog'] },
	{ code: 'DOC', route: '/doc', key: 'Cómo funciona', desc: 'Cómo está hecho Arc Terminal: arquitectura, datos, fuentes y Svelte frente a Vue', sources: 'El propio código' },
	{ code: 'HELP', route: '/help', key: 'Ayuda', desc: 'Comandos y atajos de teclado', sources: '', aliases: ['ayuda'] }
];

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
