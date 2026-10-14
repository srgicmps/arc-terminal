import type { Command } from '../commands.ts';

export default { order: 90, code: 'BOE', route: '/boe', key: 'BOE', desc: 'Sumario del Boletín Oficial del Estado de hoy', sources: 'API de datos abiertos del BOE', pinned: true, aliases: ['boletín'], arg: { param: 'q', label: 'Buscar en el BOE de hoy', example: 'BOE vivienda' } } satisfies Command;
