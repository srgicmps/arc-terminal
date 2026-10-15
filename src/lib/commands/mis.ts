import type { Command } from '../commands.ts';

export default {
	order: 160, code: 'MIS', route: '/mis', key: 'Mis valores', desc: 'Tu lista de valores, con cotización en directo', sources: 'TradingView, FINRA', pinned: true,
	manual: {
		section: 'Economía y mercados',
		what: 'Tu lista de valores con cotización en directo, sus titulares y sus próximos resultados. La lista se guarda solo en este navegador.',
		tips: ['Añade cualquier código de TradingView (NVDA, SAN, BME:REP…) o toca una sugerencia.'],
		panels: [
			{ name: 'Cotizaciones', what: 'Tus valores en directo.' },
			{ name: 'En las noticias', what: 'Titulares que nombran tus valores.' },
			{ name: 'Tus próximos resultados', what: 'Los de las próximas 2 semanas.' },
			{ name: 'Volumen en corto', what: 'Parte del volumen del último día vendida en corto (FINRA), frente a su media de 20 días. Solo valores de EE. UU.' },
			{ name: 'Editar la lista', what: 'Añadir, quitar y ordenar.' },
			{ name: 'Sugerencias', what: 'Valores conocidos: toca para añadir.' }
		]
	}
} satisfies Command;
