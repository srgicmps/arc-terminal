import type { Command } from '../commands.ts';

export default {
	order: 220, code: 'CAL', route: '/cal', key: 'Agenda', desc: 'Agenda económica de la semana', sources: 'TradingView',
	manual: {
		section: 'Economía y mercados',
		what: 'Agenda de la semana: calendario económico, reuniones de bancos centrales, próximos datos oficiales, festivos y resultados de empresas.',
		tips: ['Los resultados necesitan la clave de Finnhub (FINNHUB_API_KEY); sin ella el panel lo dice.'],
		panels: [
			{ name: 'Calendario', what: 'Datos de importancia media y alta, en hora local (TradingView).' },
			{ name: 'Bancos centrales', what: 'Próximas reuniones del BCE y la Fed.' },
			{ name: 'Próximos datos', what: 'De los calendarios oficiales, en hora de España.' },
			{ name: 'Festivos', what: 'España, Baleares y días sin bolsa de los próximos 12 meses.' },
			{ name: 'Resultados', what: 'Grandes empresas de EE. UU., próximas 2 semanas.' }
		]
	}
} satisfies Command;
