import type { Command } from '../commands.ts';

export default {
	order: 25, code: 'SEMANA', route: '/semana', key: 'Semana', desc: 'Resumen de la semana: lo más importante, mercados, datos y agenda', sources: 'IMP, FRED, BCE, Tesoro de EE. UU., CoinGecko, calendarios del INE, Eurostat y EE. UU.', aliases: ['resumen', 'week'],
	manual: {
		section: 'Portada y resumen',
		what: 'Resumen de los últimos 7 días y lo que viene en los 7 siguientes, en una sola pantalla.',
		tips: ['El top sale de IMP: un tema que estuvo varios días suma la puntuación de cada uno.'],
		panels: [
			{ name: 'Lo más importante', what: 'Los 10 temas que más sumaron en IMP en 7 días.' },
			{ name: 'Mercados', what: 'Último dato y variación en 7 días: % en precios, puntos básicos en tipos.' },
			{ name: 'Datos de la semana', what: 'Datos macro publicados en los últimos 7 días.' },
			{ name: 'Agenda', what: 'Datos que se publican en los próximos 7 días, en hora de España.' }
		]
	}
} satisfies Command;
