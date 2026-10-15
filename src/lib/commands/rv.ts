import type { Command } from '../commands.ts';

export default {
	order: 177, code: 'RV', route: '/rv', key: 'Frente al sector', desc: 'Un valor frente a sus competidores: PER, márgenes, crecimiento y dividendo', sources: 'Finnhub', aliases: ['valor relativo', 'competidores', 'peers', 'sector'], arg: { param: 's', label: 'Valor (código)', example: 'RV NVDA' },
	manual: {
		section: 'Economía y mercados',
		what: 'Compara un valor con sus competidores: PER, precio/ventas, márgenes, rentabilidad, crecimiento y dividendo frente a la mediana del sector, y en qué puesto queda.',
		args: [{ label: 'Valor (código)', examples: ['RV NVDA', 'RV KO'] }],
		tips: [
			'Solo unos 60 grandes valores de EE. UU. (el plan gratuito de Finnhub da 60 consultas por minuto).',
			'La ficha de esos valores tiene también el panel «Frente a su sector».'
		],
		panels: [
			{ name: 'Frente a su sector', what: 'Cada cifra, la mediana de los competidores y el puesto.' },
			{ name: 'Competidores', what: 'Los competidores según Finnhub, con PER, margen, ventas y capitalización.' }
		]
	}
} satisfies Command;
