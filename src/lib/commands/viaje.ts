import type { Command } from '../commands.ts';

export default {
	order: 142, code: 'VIAJE', route: '/viaje', key: 'Viaje', desc: 'Antes de un viaje: tiempo, hora, moneda, aviso y festivos', sources: 'Open-Meteo, BCE, Departamento de Estado de EE. UU., Nager.Date', aliases: ['viajar', 'trip'], arg: { param: 'ciudad', label: 'Ciudad', example: 'VIAJE Tokio' },
	manual: {
		section: 'Utilidades',
		what: 'Lo que conviene mirar antes de viajar a una ciudad: el tiempo a 7 días, la hora y la diferencia con Madrid, cuánto vale el euro allí, el aviso de viaje y los festivos de los próximos dos meses.',
		args: [{ label: 'Ciudad', examples: ['VIAJE Tokio', 'VIAJE Nueva York', 'viajar Lisboa'] }],
		tips: ['El aviso de viaje es el del Departamento de Estado de EE. UU.; para españoles, mira también el de Exteriores.', 'Los festivos son de 40 países; si el tuyo no está, el panel lo dice.'],
		panels: [
			{ name: 'El tiempo', what: 'Cielo, máxima, mínima y lluvia de los próximos 7 días (Open-Meteo).' },
			{ name: 'Festivos', what: 'Los de los próximos dos meses en ese país.' },
			{ name: 'Aviso de viaje', what: 'Nivel del 1 al 4 y enlace al aviso completo.' }
		]
	}
} satisfies Command;
