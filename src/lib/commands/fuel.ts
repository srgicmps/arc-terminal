import type { Command } from '../commands.ts';

export default { order: 170, code: 'FUEL', route: '/fuel', key: 'Gasolina', desc: 'Gasolineras más baratas de Menorca', sources: 'Ministerio para la Transición Ecológica', pinned: true, aliases: ['gasolina', 'diésel', 'carburante'], arg: { param: 'zona', label: 'Provincia (nombre o número)', example: 'FUEL Madrid' } } satisfies Command;
