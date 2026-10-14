import type { Command } from '../commands.ts';

export default { order: 150, code: 'PORT', route: '/port', key: 'Puertos', desc: 'Barcos en puertos y estrechos (Gibraltar, Róterdam, Singapur, Maó…) con AIS en directo', sources: 'aisstream.io', aliases: ['barcos', 'puertos', 'ais'] } satisfies Command;
