import type { Command } from '../commands.ts';

export default {
	order: 90, code: 'BOE', route: '/boe', key: 'BOE', desc: 'Sumario del Boletín Oficial del Estado de hoy', sources: 'API de datos abiertos del BOE', pinned: true, aliases: ['boletín'], arg: { param: 'q', label: 'Buscar en el BOE de hoy', example: 'BOE vivienda' },
	manual: {
		section: 'España',
		what: 'El sumario del Boletín Oficial del Estado de hoy, por secciones, con un buscador y tus palabras vigiladas. Debajo, el Diario Oficial de la UE.',
		args: [{ label: 'Buscar en el BOE de hoy', examples: ['BOE vivienda', 'BOE subvenciones'] }],
		tips: ['Añade palabras vigiladas (por ejemplo, «Menorca» o «hipoteca»): las disposiciones que las nombran salen arriba, en su propio panel.'],
		panels: [
			{ name: 'Palabras vigiladas', what: 'Lo que nombra tus palabras; se guardan en este navegador.' },
			{ name: 'Secciones del BOE', what: 'Un panel por sección (disposiciones generales, autoridades…).' },
			{ name: 'Diario Oficial de la UE · serie L', what: 'Reglamentos, directivas y decisiones, con filtro por tema.' }
		]
	}
} satisfies Command;
