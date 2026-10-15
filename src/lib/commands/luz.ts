import type { Command } from '../commands.ts';

export default {
	order: 120, code: 'LUZ', route: '/luz', key: 'Luz', desc: 'Precio de la luz hora a hora, hoy y mañana', sources: 'Red Eléctrica (REE)', pinned: true, aliases: ['electricidad', 'pvpc'],
	date: 'panel',
	manual: {
		section: 'España',
		what: 'Precio de la luz (PVPC) hora a hora, hoy y mañana, de dónde sale la electricidad y cómo ha evolucionado el precio.',
		tips: ['«LUZ mañana» (o «LUZ 17/10») salta al panel de ese día.', 'El PVPC de mañana se publica hacia las 20:30; antes sale el precio del mercado mayorista.', 'En «Horas baratas» eliges cuántas horas seguidas necesitas (la lavadora, unas 2; el coche, 3 o más).', 'Cada día tiene su botón «Compartir» con la media y la hora más barata.'],
		panels: [
			{ name: 'Horas baratas', what: 'Las 3 mejores franjas de 1, 2 o 3 horas seguidas que quedan hoy y las de mañana.' },
			{ name: 'Hoy / Mañana', what: 'Media, mínimo y máximo, y una barra por hora.' },
			{ name: 'De dónde sale la luz', what: 'Mix de generación: renovables, nuclear, gas…' },
			{ name: 'Evolución del PVPC', what: 'Media de cada día.' }
		]
	}
} satisfies Command;
