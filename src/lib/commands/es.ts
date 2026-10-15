import type { Command } from '../commands.ts';

export default {
	order: 50, code: 'ES', route: '/es', key: 'España', desc: 'España: actualidad, BOE y luz', sources: 'El País, RTVE, elDiario.es, El Mundo, Europa Press, BOE, REE', pinned: true, aliases: ['españa'],
	manual: {
		section: 'España',
		what: 'España: titulares, cifras clave del INE, turismo y vivienda, el BOE de hoy y comunicados del Gobierno y de Europa.',
		panels: [
			{ name: 'Titulares', what: 'Noticias de los medios españoles.' },
			{ name: 'Terremotos en España', what: 'Los más fuertes de los últimos 10 días (IGN).' },
			{ name: 'España en cifras', what: 'Último dato de paro, IPC y otros indicadores.' },
			{ name: 'Turismo y vivienda', what: 'Datos del INE.' },
			{ name: 'BOE de hoy', what: 'Disposiciones generales; «BOE ›» abre el sumario entero.' },
			{ name: 'Gobierno y Europa', what: 'Comunicados de La Moncloa, el Banco de España y la UE.' }
		]
	}
} satisfies Command;
