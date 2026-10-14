import type { Command } from '../commands.ts';

export default {
	order: 250, code: 'STATUS', route: '/status', key: 'Fuentes', desc: 'Estado de todas las fuentes de datos', sources: 'Arc Terminal',
	manual: {
		section: 'Sistema',
		what: 'Estado de las fuentes de datos: cuándo se descargó cada una por última vez, si falló y qué canales RSS responden.',
		tips: ['Si un panel no sale o está vacío, mira aquí si su fuente está caída o necesita una clave.'],
		panels: [
			{ name: 'Tormentas solares', what: 'Índice Kp y escala G de NOAA.' },
			{ name: 'Fuentes', what: 'Una fila por fuente con sus últimas pasadas.' },
			{ name: 'Canales RSS', what: 'Qué canales responden.' }
		]
	}
} satisfies Command;
