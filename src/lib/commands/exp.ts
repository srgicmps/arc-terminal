import type { Command } from '../commands.ts';

export default {
	order: 242, code: 'EXP', route: '/x', key: 'Experiencias', desc: 'Experiencias: otras formas de usar Arc (periódico, sala de control, feed…)', sources: 'Arc Terminal', aliases: ['experiencia', 'experiencias'], arg: { param: 'e', label: 'Experiencia', example: 'EXP periodico' },
	manual: {
		section: 'Sistema',
		what: 'Las experiencias cambian la forma de usar Arc con los mismos datos: un periódico, una sala de control, una cosa cada vez… «EXP» solo enseña todas.',
		args: [{ label: 'Experiencia', examples: ['EXP periodico'] }],
		tips: ['En HELP, «Al entrar», puedes elegir que Arc se abra directamente en una experiencia.', 'Esc o «← Arc» vuelve a la terminal.'],
		panels: [{ name: 'Experiencias', what: 'Todas, con qué es cada una.' }]
	}
} satisfies Command;
