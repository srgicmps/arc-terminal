import type { Command } from '../commands.ts';

export default {
	order: 175, code: 'CMP', route: '/cmp', key: 'Comparar', desc: 'Compara varios valores en un gráfico en base 100', sources: 'TradingView', aliases: ['comparar', 'comparativa'], arg: { param: 's', label: 'Valores separados por espacios', example: 'CMP NVDA AMD AVGO' },
	manual: {
		section: 'Economía y mercados',
		what: 'Compara varios valores en un mismo gráfico, en base 100: todos parten de 100 y se ve cuál ha subido más.',
		args: [{ label: 'Valores separados por espacios', examples: ['CMP NVDA AMD AVGO', 'CMP AAPL MSFT'] }],
		tips: [
			'Los valores van en la URL: puedes compartir el enlace de la comparación.',
			'Desde la barra, también «NVDA vs AMD» y, con rango, «NVDA vs AMD 5a» (1d, 5d, 1m, 3m, 6m, ytd, 1a, 5a, max).'
		],
		panels: [
			{ name: 'Rentabilidad comparada', what: 'El gráfico en base 100.' },
			{ name: 'Rentabilidad', what: 'Cuánto ha subido o bajado cada valor en el periodo.' }
		]
	}
} satisfies Command;
