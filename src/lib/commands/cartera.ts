import type { Command } from '../commands.ts';

export default {
	order: 173, code: 'CARTERA', route: '/cartera', key: 'Cartera', desc: 'Tu cartera: posiciones, ganancia o pérdida y reparto', sources: 'Finnhub (EE. UU.), precio a mano, BCE (cambios)', aliases: ['posiciones', 'portfolio', 'inversiones'],
	manual: {
		section: 'Tu dinero',
		what: 'Apunta lo que tienes (código, cantidad, precio de compra y divisa) y te dice lo que vale hoy en euros, cuánto ganas o pierdes y cómo está repartido.',
		tips: [
			'Precios automáticos solo para los valores de EE. UU. que ya descarga Arc (Finnhub, con retraso). Para el resto, escribe el precio a mano en la tabla.',
			'Tus posiciones se guardan solo en tu navegador y, con cuenta, en tus ajustes privados: no las ve nadie más.',
			'Para seguir valores sin tenerlos, usa MIS.'
		],
		panels: [
			{ name: 'Resumen', what: 'Lo que vale hoy, lo invertido y la ganancia o pérdida, en euros.' },
			{ name: 'Posiciones', what: 'Cada valor con su precio de hoy (o el tuyo), la variación del día, la ganancia y su peso. Abajo, para añadir.', keys: ['posiciones'] },
			{ name: 'Reparto por sector', what: 'Cuánto pesa cada sector (el que escribas al añadir).' },
			{ name: 'Reparto por divisa', what: 'Cuánto tienes en dólares, euros…' }
		]
	}
} satisfies Command;
