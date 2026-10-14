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
		| '/cmp'
		| '/pais'
		| '/mis'
		| '/fondos'
		| '/help'
		| '/doc'
		| '/status'
		| '/chess'
		| '/tv';
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
	{ code: 'CMP', route: '/cmp', key: 'Comparar', desc: 'Compara varios valores en un gráfico en base 100', sources: 'TradingView', aliases: ['comparar', 'comparativa'], arg: { param: 's', label: 'Valores separados por espacios', example: 'CMP NVDA AMD AVGO' } },
	{ code: 'FONDOS', route: '/fondos', key: 'Fondos', desc: 'Carteras de Berkshire, Pershing Square, Third Point, Bridgewater, ARK y Renaissance: mayores posiciones, compras y ventas', sources: 'SEC EDGAR (13F)', aliases: ['13f', 'carteras', 'buffett'] },
	{ code: 'NEWS', route: '/news', key: 'Buscar', desc: 'Buscador en todos los titulares de todas las secciones', sources: 'Todos los medios', arg: { param: 'q', label: 'Buscar en los titulares', example: 'NEWS inflación' } },
	{ code: 'PAIS', route: '/pais', key: 'País', desc: 'Ficha de un país: PIB, IPC, paro, deuda, tipos, bono, moneda, previsiones del FMI y titulares', sources: 'Eurostat, BLS, FRED, BCE, BIS, Tesoro de EE. UU., FMI, todos los medios', aliases: ['país', 'country'], arg: { param: 'c', label: 'País (nombre o código)', example: 'PAIS Alemania' } },
	{ code: 'WIKI', route: '/wiki', key: 'Wikipedia', desc: 'Lo más leído en Wikipedia y efemérides del día', sources: 'Wikipedia en español' },
	{ code: 'CAL', route: '/cal', key: 'Agenda', desc: 'Agenda económica de la semana', sources: 'TradingView' },
	{ code: 'CHESS', route: '/chess', key: 'Ajedrez', desc: 'Ajedrez contra Stockfish (5 niveles), análisis y problema del día', sources: 'Stockfish, chess.js, Lichess', aliases: ['ajedrez'] },
	{ code: 'TV', route: '/tv', key: 'Modo TV', desc: 'Modo TV: las vistas van rotando solas, a pantalla completa', sources: 'Arc Terminal', aliases: ['tele', 'televisión'], arg: { param: 'tv', label: 'Vistas que rotan', example: 'TV TOP,WS,GEO' } },
	{ code: 'STATUS', route: '/status', key: 'Fuentes', desc: 'Estado de todas las fuentes de datos', sources: 'Arc Terminal' },
	{ code: 'DOC', route: '/doc', key: 'Cómo funciona', desc: 'Cómo está hecho Arc Terminal: arquitectura, datos, fuentes y Svelte frente a Vue', sources: 'El propio código' },
	{ code: 'HELP', route: '/help', key: 'Ayuda', desc: 'Comandos y atajos de teclado', sources: '', aliases: ['ayuda'] }
];
