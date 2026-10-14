import type { Command } from '../commands.ts';

export default { order: 240, code: 'TV', route: '/tv', key: 'Modo TV', desc: 'Modo TV: las vistas van rotando solas, a pantalla completa', sources: 'Arc Terminal', aliases: ['tele', 'televisión'], arg: { param: 'tv', label: 'Vistas que rotan', example: 'TV TOP,WS,GEO' } } satisfies Command;
