import type { Command } from '../commands.ts';

export default {
	order: 62, code: 'MOST', route: '/most', key: 'Más activos', desc: 'Los que más suben, bajan y se negocian hoy en EE. UU., Alemania y España', sources: 'TradingView', aliases: ['más negociados', 'mas negociados', 'suben', 'bajan', 'movers'],
	manual: {
		section: 'Economía y mercados',
		what: 'Los valores que más suben, más bajan y más se negocian hoy, con las tres bolsas a la vista: EE. UU., Alemania y España.',
		tips: ['En WS está el mismo panel con un selector de bolsa.', 'Pulsa un valor para ver su gráfico en TradingView.'],
		panels: [
			{ name: 'EE. UU.', what: 'NYSE, Nasdaq y AMEX juntos.', keys: ['usa', 'eeuu'] },
			{ name: 'Alemania', what: 'Xetra (Fráncfort).', keys: ['de', 'xetra'] },
			{ name: 'España', what: 'Bolsa de Madrid (BME).', keys: ['bme', 'madrid'] }
		]
	}
} satisfies Command;
