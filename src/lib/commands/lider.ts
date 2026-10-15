import type { Command } from '../commands.ts';

export default {
	order: 110, code: 'LIDER', route: '/lider', key: 'Líderes', desc: 'Qué hacen ahora Sánchez, Trump, Lagarde, Warsh y von der Leyen: agenda de hoy y lo último', sources: 'La Moncloa, Roll Call Factba.se, Casa Blanca, Federal Register, BCE, Fed, Comisión Europea', aliases: ['líderes'], arg: { param: 'id', label: 'Líder (nombre)', example: 'LIDER Lagarde' },
	manual: {
		section: 'Mundo',
		what: 'Qué hacen ahora Sánchez, Trump, Lagarde, Warsh y von der Leyen: su agenda de hoy en hora de Madrid y lo último que han hecho.',
		tips: ['Escribe su nombre en la barra (sánchez, trump, lagarde, warsh, von der leyen) o «LIDER Lagarde» y se abre solo su ficha.', 'Arriba, «Líder» cambia de ficha o vuelve a verlos todos.'],
		args: [{ label: 'Líder (nombre)', examples: ['LIDER Lagarde', 'LIDER Warsh'], options: ['sánchez', 'trump', 'lagarde', 'warsh', 'von der leyen'] }],
		panels: [
			{ name: 'Un panel por líder', what: 'Agenda de hoy; si ya no queda nada, el siguiente acto.' },
			{ name: 'Lo último', what: 'Sus titulares y comunicados más recientes.' }
		]
	}
} satisfies Command;
