import type { Command } from '../commands.ts';

export default { order: 130, code: 'AGUA', route: '/agua', key: 'Agua', desc: 'Reservas de agua: embalses de España y sequía en Europa', sources: 'MITECO, Copernicus (European Drought Observatory)', aliases: ['embalses', 'sequía', 'sequia'] } satisfies Command;
