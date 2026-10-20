import type { Command } from '../commands.ts';

export default {
	order: 270, code: 'HELP', route: '/help', key: 'Ayuda', desc: 'Comandos y atajos de teclado', sources: '', aliases: ['ayuda'],
	manual: {
		section: 'Sistema',
		what: 'La chuleta rápida: todos los comandos, los atajos de teclado, los comandos con texto detrás y los valores conocidos.',
		tips: [
			'Para el detalle de cada vista y sus paneles, abre el MANUAL.',
			'Con cuenta, en «A tu gusto», «Tu cuenta»: «Cerrar sesión» en este dispositivo o «Borrar mi cuenta» (hay que escribir BORRAR).'
		],
		panels: [
			{ name: 'Comandos', what: 'Lista completa con sus fuentes.' },
			{ name: 'Atajos de teclado', what: 'Los de la barra, los paneles y la pantalla.' },
			{ name: 'Con texto detrás', what: 'Ejemplos de comandos con argumento.' },
			{ name: 'Valores', what: 'Códigos conocidos: abre su ficha.' }
		]
	}
} satisfies Command;
