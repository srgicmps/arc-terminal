import type { Command } from '../commands.ts';

export default {
	order: 190, code: 'NEWS', route: '/news', key: 'Buscar', desc: 'Buscador en todos los titulares de todas las secciones', sources: 'Todos los medios', arg: { param: 'q', label: 'Buscar en los titulares', example: 'NEWS inflación' },
	manual: {
		section: 'Utilidades',
		what: 'Buscador en todos los titulares de todas las secciones, con filtro por sección y un archivo de los últimos meses.',
		args: [{ label: 'Buscar en los titulares', examples: ['NEWS inflación', 'NEWS Lagarde'] }],
		tips: ['Con 3 letras o más busca también en el archivo, mes a mes.'],
		panels: [
			{ name: 'Resultados', what: 'Titulares de ahora que coinciden.' },
			{ name: 'En el archivo', what: 'Los de meses anteriores.' }
		]
	}
} satisfies Command;
