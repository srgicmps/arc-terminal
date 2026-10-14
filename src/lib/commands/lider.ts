import type { Command } from '../commands.ts';

export default {
	order: 110, code: 'LIDER', route: '/lider', key: 'Líderes', desc: 'Qué hacen ahora Sánchez, Trump y Lagarde: agenda de hoy y lo último', sources: 'La Moncloa, Roll Call Factba.se, Casa Blanca, Federal Register, BCE', aliases: ['líderes', 'sánchez', 'trump', 'lagarde'],
	manual: {
		section: 'Mundo',
		what: 'Qué hacen ahora Sánchez, Trump y Lagarde: su agenda de hoy en hora de Madrid y lo último que han hecho.',
		tips: ['También se abre escribiendo su nombre en la barra: sánchez, trump o lagarde.'],
		panels: [
			{ name: 'Un panel por líder', what: 'Agenda de hoy; si ya no queda nada, el siguiente acto.' },
			{ name: 'Lo último', what: 'Sus titulares y comunicados más recientes.' }
		]
	}
} satisfies Command;
