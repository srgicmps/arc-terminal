import type { Command } from '../commands.ts';

export default {
	order: 35, code: 'ECST', route: '/ecst', key: 'G20', desc: 'Las grandes economías en una tabla ordenable', sources: 'FMI, BIS, BCE, Tesoro de EE. UU., MOF de Japón', aliases: ['g20', 'países', 'economías'],
	manual: {
		section: 'Economía y mercados',
		what: 'Los países del G20 (y España) en una sola tabla: crecimiento, inflación, paro, tipo oficial, bono a 10 años, deuda y saldo público. Se ordena por cualquier columna.',
		tips: ['Pulsa una cabecera para ordenar de mayor a menor; otra vez, al revés.', 'PIB, IPC, paro, deuda y saldo son la estimación del FMI para este año.'],
		panels: [{ name: 'G20 en cifras', what: 'Una fila por país, con «—» donde no hay dato.' }]
	}
} satisfies Command;
