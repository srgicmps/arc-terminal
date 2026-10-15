import type { Command } from '../commands.ts';

export default {
	order: 100, code: 'USGOV', route: '/usgov', key: 'Gob. EE. UU.', desc: 'Federal Register: decretos presidenciales y normas de EE. UU.', sources: 'Federal Register, Casa Blanca, Reserva Federal',
	manual: {
		section: 'Mundo',
		what: 'El Gobierno de EE. UU. por escrito: decretos presidenciales y normas del Federal Register, comunicados de la Casa Blanca y la Fed, y sanciones.',
		panels: [
			{ name: 'Documentos presidenciales', what: 'Órdenes ejecutivas, proclamaciones y memorandos.' },
			{ name: 'Casa Blanca y Fed', what: 'Comunicados.' },
			{ name: 'Sanciones y aranceles', what: 'OFAC, USTR e ITA (Section 232).' },
			{ name: 'Normas nuevas', what: 'Reglamentos definitivos.' }
		]
	}
} satisfies Command;
