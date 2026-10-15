import type { Command } from '../commands.ts';

export default {
	order: 66, code: 'G', route: '/g', key: 'Gráfico', desc: 'Gráfico de cualquier serie de la terminal, sola o comparada', sources: 'Todas las series de la terminal', aliases: ['gráfico', 'series'], arg: { param: 's', label: 'Series separadas por comas', example: 'G US10, BUND' },
	manual: {
		section: 'Economía y mercados',
		what: 'Dibuja cualquier serie que ya descarga la terminal (bonos, tipos, inflación, paro, petróleo…) y compara varias en el mismo gráfico.',
		args: [{ label: 'Una o varias series, por atajo, id o nombre', examples: ['G US10, BUND', 'G euríbor 12, ESTR', 'G VIX'] }],
		tips: [
			'Con unidades distintas, «Base 100» pone todas a 100 en la primera fecha que comparten.',
			'Cada serie llega hasta donde la guarda la terminal: algunas tienen años y otras, pocos meses. Se avisa debajo.',
			'En «Series disponibles» se busca entre todas y se añade con un toque.'
		],
		panels: [
			{ name: 'Gráfico', what: 'Las series pedidas, con su valor al pasar el dedo.' },
			{ name: 'Series del gráfico', what: 'Último dato, fecha y desde cuándo hay historial.' },
			{ name: 'Series disponibles', what: 'Atajos y buscador de todas las series.' }
		]
	}
} satisfies Command;
