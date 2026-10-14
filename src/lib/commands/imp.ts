import type { Command } from '../commands.ts';

export default { order: 20, code: 'IMP', route: '/imp', key: 'Importante', desc: 'Lo más importante de hoy, la semana, el mes y el año (sin IA)', sources: 'Todos los titulares, BOE, Federal Register, Wikipedia', pinned: true, aliases: ['importante', 'destacado'] } satisfies Command;
