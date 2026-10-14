import type { Command } from '../commands.ts';

export default { order: 110, code: 'LIDER', route: '/lider', key: 'Líderes', desc: 'Qué hacen ahora Sánchez, Trump, Lagarde, Warsh y von der Leyen: agenda de hoy y lo último', sources: 'La Moncloa, Roll Call Factba.se, Casa Blanca, Federal Register, BCE, Fed, Comisión Europea', aliases: ['líderes'], arg: { param: 'id', label: 'Líder (nombre)', example: 'LIDER Lagarde' } } satisfies Command;
