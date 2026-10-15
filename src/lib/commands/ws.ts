import type { Command } from '../commands.ts';

export default {
	order: 60, code: 'WS', route: '/ws', key: 'Wall Street', desc: 'Wall Street: mapa de calor, curva de tipos, divisas y cripto', sources: 'TradingView, Tesoro de EE. UU., BCE, CoinGecko, CNBC, WSJ', pinned: true, aliases: ['bolsa', 'wall street'],
	manual: {
		section: 'Economía y mercados',
		what: 'Wall Street e inversión: mapa de calor, índices y materias primas en directo, curvas de tipos, divisas, cripto y subastas del Tesoro.',
		tips: ['El mapa de calor cambia entre S&P 500, Nasdaq 100, DAX, IBEX 35, cripto y divisas, y recuerda el último elegido.'],
		panels: [
			{ name: 'Sesiones de las bolsas', what: 'Qué bolsas están abiertas, en hora de Madrid.' },
			{ name: 'Mapa de calor', what: 'Variación del día de cada valor del índice elegido.' },
			{ name: 'Mercados', what: 'Índices en directo (TradingView).' },
			{ name: 'Materias primas', what: 'Precios en dólares, en directo.' },
			{ name: 'Los que más se mueven', what: 'Los que más suben, bajan y se negocian hoy.' },
			{ name: 'Titulares', what: 'Noticias de mercados.' },
			{ name: 'Curvas de tipos', what: 'EE. UU., zona euro y Japón, hoy y hace un año.' },
			{ name: 'Divisas', what: 'Cambio de referencia del BCE frente al euro.' },
			{ name: 'Conversor', what: 'Convierte entre divisas con los tipos del BCE; recuerda lo último.' },
			{ name: 'Cripto', what: 'Las principales por capitalización.' },
			{ name: 'Subastas del Tesoro', what: 'Próximas subastas y resultados de bonos y notas de EE. UU.' }
		]
	}
} satisfies Command;
