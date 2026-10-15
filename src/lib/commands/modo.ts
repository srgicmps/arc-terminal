import type { Command } from '../commands.ts';

export default {
	order: 245, code: 'MODO', route: '/modo', key: 'Modo', desc: 'Modo Sencillo (lo esencial, explicado) o Terminal (todo, denso)', sources: 'Arc Terminal', aliases: ['sencillo', 'terminal', 'experto', 'simple'], arg: { param: 'm', label: 'Sencillo o Terminal', example: 'MODO sencillo' },
	manual: {
		section: 'Sistema',
		what: 'Cambia entre el modo Sencillo (menos paneles, letra mayor y explicaciones de cada dato) y el modo Terminal (todo, denso, como Bloomberg).',
		args: [{ label: 'Modo', examples: ['MODO sencillo', 'MODO terminal'], options: ['sencillo', 'terminal'] }],
		tips: ['En Sencillo, al final de cada cabecera, «Ver todos» enseña los paneles ocultos de esa vista.', 'También se cambia en HELP, «A tu gusto».'],
		panels: [{ name: 'Modo', what: 'Los dos modos, qué cambia en cada uno y el botón para elegir.' }]
	}
} satisfies Command;
