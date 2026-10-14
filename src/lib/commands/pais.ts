import type { Command } from '../commands.ts';

export default {
	order: 200, code: 'PAIS', route: '/pais', key: 'País', desc: 'Ficha de un país: PIB, IPC, paro, deuda, tipos, bono, moneda, previsiones del FMI y titulares', sources: 'Eurostat, BLS, FRED, BCE, BIS, Tesoro de EE. UU., FMI, todos los medios', aliases: ['país', 'country'], arg: { param: 'c', label: 'País (nombre o código)', example: 'PAIS Alemania' },
	manual: {
		section: 'Mundo',
		what: 'Ficha de un país: PIB, IPC, paro, deuda, tipos, bono, moneda, previsiones del FMI y sus titulares. Solo salen los datos que existen para ese país.',
		args: [{ label: 'País (nombre o código)', examples: ['PAIS Alemania', 'PAIS DE', 'país Japón'] }],
		panels: [
			{ name: 'Países', what: 'La lista para elegir, sin país.' },
			{ name: 'Tipos y deuda', what: 'Tipo oficial, bono y deuda.' },
			{ name: 'Moneda', what: 'Su cambio y la variación en un mes.' },
			{ name: 'Previsiones del FMI', what: 'PIB e inflación previstos.' },
			{ name: 'En las noticias', what: 'Titulares que lo nombran.' }
		]
	}
} satisfies Command;
