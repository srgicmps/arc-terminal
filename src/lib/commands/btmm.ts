import type { Command } from '../commands.ts';

export default {
	order: 64, code: 'BTMM', route: '/btmm', key: 'Monetario', desc: 'Mercado monetario de EE. UU. y la zona euro: SOFR, €STR, euríbor, letras', sources: 'Fed de Nueva York, FRED, Tesoro de EE. UU., BCE', aliases: ['mercado monetario', 'sofr', 'estr', 'euribor', 'letras'],
	manual: {
		section: 'Economía y mercados',
		what: 'Los tipos a corto plazo de los dos lados del Atlántico en una pantalla: a un día, letras y euríbor, con su cambio en el día y en el mes.',
		tips: [
			'SOFR por encima de la remuneración de las reservas (IORB) suele ser señal de tensión en la financiación a corto.',
			'El euríbor es mensual (media del BCE); el resto, diario. Sin la clave de FRED faltan IORB y la letra a 3 meses de FRED, pero la tabla sale igual.'
		],
		panels: [
			{ name: 'EE. UU.', what: 'SOFR, TGCR, BGCR, EFFR y OBFR (Fed de Nueva York, con su volumen), IORB y letras del Tesoro a 1, 3 y 6 meses.', keys: ['sofr', 'letras'] },
			{ name: 'Zona euro', what: 'Facilidad de depósito del BCE, €STR, euríbor a 3 y 12 meses y la curva AAA a 3 meses y 1 año.', keys: ['estr', 'euribor'] }
		]
	}
} satisfies Command;
