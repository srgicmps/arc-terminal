import type { Command } from '../commands.ts';

export default { order: 110, code: 'LIDER', route: '/lider', key: 'Líderes', desc: 'Qué hacen ahora Sánchez, Trump y Lagarde: agenda de hoy y lo último', sources: 'La Moncloa, Roll Call Factba.se, Casa Blanca, Federal Register, BCE', aliases: ['líderes', 'sánchez', 'trump', 'lagarde'] } satisfies Command;
