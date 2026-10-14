import type { Command } from '../commands.ts';

export default {
	order: 120, code: 'LUZ', route: '/luz', key: 'Luz', desc: 'Precio de la luz hora a hora, hoy y mañana', sources: 'Red Eléctrica (REE)', pinned: true, aliases: ['electricidad', 'pvpc'],
	manual: {
		section: 'España',
		what: 'Precio de la luz (PVPC) hora a hora, hoy y mañana, de dónde sale la electricidad y cómo ha evolucionado el precio.',
		tips: ['El PVPC de mañana se publica hacia las 20:30; antes sale el precio del mercado mayorista.', 'Cada día tiene su botón «Compartir» con la media y la hora más barata.'],
		panels: [
			{ name: 'Hoy / Mañana', what: 'Media, mínimo y máximo, y una barra por hora.' },
			{ name: 'De dónde sale la luz', what: 'Mix de generación: renovables, nuclear, gas…' },
			{ name: 'Evolución del PVPC', what: 'Media de cada día.' }
		]
	}
} satisfies Command;
