import type { Command } from '../commands.ts';

export default { order: 30, code: 'ECO', route: '/eco', key: 'Economía', desc: 'Economía y macro: paro, inflación, PIB, tipos', sources: 'Eurostat, BCE, BLS, Tesoro de EE. UU., El País, Expansión, FT', pinned: true } satisfies Command;
