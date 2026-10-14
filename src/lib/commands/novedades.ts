import type { Command } from '../commands.ts';

export default { order: 255, code: 'NOVEDADES', route: '/novedades', key: 'Novedades', desc: 'Lo que ha cambiado en Arc Terminal esta semana', sources: 'GitHub (PR fusionados)', aliases: ['cambios', 'changelog'] } satisfies Command;
