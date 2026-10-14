import type { Command } from '../commands.ts';

export default { order: 190, code: 'NEWS', route: '/news', key: 'Buscar', desc: 'Buscador en todos los titulares de todas las secciones', sources: 'Todos los medios', arg: { param: 'q', label: 'Buscar en los titulares', example: 'NEWS inflación' } } satisfies Command;
