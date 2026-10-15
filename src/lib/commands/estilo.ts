import type { Command } from '../commands.ts';

export default {
	order: 262, code: 'ESTILO', route: '/estilo', key: 'Estilo', desc: 'Estética de la web, con vista previa', sources: '—', aliases: ['estetica', 'aspecto'],
	arg: { param: 's', label: 'Estética', example: 'ESTILO grafito' },
	manual: {
		section: 'Sistema',
		what: 'Cambia el aspecto de toda la web: colores, letras, espacios y gráficos.',
		args: [{ label: 'Estética', examples: ['ESTILO grafito', 'ESTILO terminal'] }],
		panels: [{ name: 'Estética', what: 'Las estéticas con su vista previa.' }]
	}
} satisfies Command;
