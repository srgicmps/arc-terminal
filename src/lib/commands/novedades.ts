import type { Command } from '../commands.ts';

export default {
	order: 255, code: 'NOVEDADES', route: '/novedades', key: 'Novedades', desc: 'Lo que ha cambiado en Arc Terminal esta semana', sources: 'GitHub (PR fusionados)', aliases: ['cambios', 'changelog'],
	manual: {
		section: 'Sistema',
		what: 'Lo que ha cambiado en Arc Terminal esta semana, día a día, a partir de los cambios publicados en GitHub.',
		tips: ['Si un cambio es de una vista, su código sale a la derecha y lleva a ella.'],
		panels: [{ name: 'Novedades', what: 'Los cambios de cada día, del más reciente al más antiguo.' }]
	}
} satisfies Command;
