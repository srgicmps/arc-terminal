import type { Command } from '../commands.ts';

export default {
	order: 62, code: 'WB', route: '/wb', key: 'Bonos', desc: 'Bonos a 2, 10 y 30 años de EE. UU., zona euro y Japón', sources: 'Tesoro de EE. UU., BCE, MOF de Japón', aliases: ['bonos', 'deuda soberana', 'rentabilidades'],
	manual: {
		section: 'Economía y mercados',
		what: 'Los bonos de los tres grandes emisores en una tabla: rentabilidad a 2, 10 y 30 años, cuánto se ha movido el 10 años y la pendiente de la curva.',
		tips: [
			'Zona euro: la curva del BCE con los bonos AAA de la zona (no un país concreto). Japón: el Ministerio de Finanzas, un día hábil de retraso.',
			'Reino Unido y China no están: sus rentabilidades diarias solo salen de fuentes de pago.'
		],
		panels: [{ name: 'Bonos soberanos', what: 'Una fila por emisor: 2A, 10A, 30A, cambio del 10 años en el día y en un mes, y pendientes 2–10 y 10–30 en pb.' }]
	}
} satisfies Command;
