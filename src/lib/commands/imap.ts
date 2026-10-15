import type { Command } from '../commands.ts';

export default {
	order: 64, code: 'IMAP', route: '/imap', key: 'Mapa de calor', desc: 'Mapas de calor de índices y países, sectores de EE. UU. y bolsas del mundo', sources: 'TradingView', aliases: ['mapa de calor', 'heatmap', 'sectores'],
	manual: {
		section: 'Economía y mercados',
		what: 'Mapas de calor de más índices y países que en WS (Dow Jones, CAC 40, FTSE 100, Nikkei, todas las acciones de un país…), cómo va cada sector de EE. UU. y un índice por país.',
		tips: ['El mapa elegido va en la URL (/imap?mapa=ftse): puedes compartir el enlace.', 'En el mapa, las casillas van agrupadas por sector y su tamaño es la capitalización.'],
		panels: [
			{ name: 'Mapa de calor', what: 'Variación del día de cada valor del índice o del país elegido.' },
			{ name: 'Sectores de EE. UU.', what: 'Los 11 sectores del S&P 500, con sus fondos Select Sector SPDR.', keys: ['sectores'] },
			{ name: 'Bolsas del mundo', what: 'Un índice de referencia por país, en directo.', keys: ['mundo', 'paises', 'países'] }
		]
	}
} satisfies Command;
