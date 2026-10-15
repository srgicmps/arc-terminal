import type { Command } from '../commands.ts';

export default {
	order: 262, code: 'ESTILO', route: '/estilo', key: 'Estilo', desc: 'Elige la estética: Terminal, Grafito, Cristal, Fósforo…', sources: '—', aliases: ['estetica', 'aspecto', 'apariencia'],
	arg: { param: 's', label: 'Nombre de la estética', example: 'ESTILO grafito' },
	manual: {
		section: 'Sistema',
		what: 'Cambia el aspecto de toda la web: colores, letras, espacios, esquinas, sombras, gráficos y animaciones. «Terminal» es la de siempre, al estilo Bloomberg; hay otras, de la sobria «Grafito» a «Fósforo» (monitor de los 80) o «Alto contraste», para leer mejor.',
		tips: ['«ESTILO grafito» o «ESTILO terminal» la cambian al momento.', 'Se combina con el tema de día o de noche, la densidad y el modo de «A tu gusto». Las estéticas con color propio no usan el acento elegido.', 'Con cuenta, se guarda en ella y vale en todos tus dispositivos.'],
		args: [{ label: 'Nombre de la estética', examples: ['ESTILO grafito', 'ESTILO terminal', 'ESTILO alto contraste'] }],
		panels: [{ name: 'Estética', what: 'Todas las estéticas con su vista previa; la que tocas se aplica al momento.' }]
	}
} satisfies Command;
