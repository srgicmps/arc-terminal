import type { Command } from '../commands.ts';

export default {
	order: 262, code: 'ESTILO', route: '/estilo', key: 'Estilo', desc: 'Elige la estética: Terminal o Moderna', sources: '—', aliases: ['estetica', 'aspecto', 'apariencia'],
	arg: { param: 's', label: 'Terminal o Moderna', example: 'ESTILO moderna' },
	manual: {
		section: 'Sistema',
		what: 'Cambia el aspecto de toda la web. «Terminal» es la de siempre, al estilo Bloomberg: fondo casi negro, letra monoespaciada y paneles pegados con líneas de 1 px. «Moderna» separa los paneles como tarjetas, con esquinas suaves, sombra leve y la letra Inter.',
		tips: ['«ESTILO moderna» o «ESTILO terminal» la cambian sin abrir la vista.', 'Se combina con el tema de día o de noche, el acento y la densidad de «A tu gusto».', 'Con cuenta, se guarda en ella y vale en todos tus dispositivos.'],
		args: [{ label: 'Terminal o Moderna', examples: ['ESTILO moderna', 'ESTILO terminal'], options: ['terminal', 'moderna'] }],
		panels: [{ name: 'Estética', what: 'Las dos estéticas; la elegida se aplica al momento.' }]
	}
} satisfies Command;
