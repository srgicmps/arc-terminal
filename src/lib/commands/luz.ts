import type { Command } from '../commands.ts';

export default { order: 120, code: 'LUZ', route: '/luz', key: 'Luz', desc: 'Precio de la luz hora a hora, hoy y mañana', sources: 'Red Eléctrica (REE)', pinned: true, aliases: ['electricidad', 'pvpc'] } satisfies Command;
