import type { Command } from '../commands.ts';

export default {
	order: 176, code: 'EQS', route: '/eqs', key: 'Buscador', desc: 'Buscador de acciones: filtra por sector, PER, dividendo o subida', sources: 'TradingView', aliases: ['screener', 'buscador de acciones', 'filtrar acciones'],
	manual: {
		section: 'Economía y mercados',
		what: 'Un buscador de acciones de TradingView: eliges bolsa, un punto de partida (las más grandes, las que más suben, dividendo alto…) y afinas con sus filtros de sector, PER, dividendo o subida.',
		tips: [
			'La bolsa, el punto de partida y las columnas van en la URL (/eqs?bolsa=spain&lista=high_dividend): puedes compartir el enlace.',
			'Los filtros finos (sector, PER, capitalización…) están en la barra del propio widget.'
		],
		panels: [{ name: 'Buscador de acciones', what: 'La tabla de TradingView, con sus filtros.' }]
	}
} satisfies Command;
