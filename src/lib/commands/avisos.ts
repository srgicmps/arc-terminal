import type { Command } from '../commands.ts';

export default {
	order: 252, code: 'AVISOS', route: '/avisos', key: 'Tus avisos', desc: 'Avisos al móvil a tu gusto: qué, hasta qué nivel y cuándo', sources: 'ntfy', aliases: ['alertas', 'ntfy', 'notificaciones'],
	manual: {
		section: 'Sistema',
		what: 'Tus avisos al móvil con la app ntfy: eliges los temas, hasta qué nivel, un tope al día, tus valores y un horario de silencio. Por defecto, los mismos que recibe Sergi. Solo en arcterminal.dev, con tu cuenta.',
		tips: ['Al activarlos te da un canal propio y secreto: suscríbete a él en la app ntfy. Si alguien lo ve, «Canal nuevo» lo cambia.', 'En el silencio solo llegan los urgentes (P1).'],
		panels: [
			{ name: 'Qué te llega', what: 'Temas, nivel, tope diario y silencio.' },
			{ name: 'Tus valores', what: 'Los valores de EE. UU. que vigilar (subidas y bajadas fuertes del día).' },
			{ name: 'En tu móvil', what: 'Cómo suscribirte a tu canal en la app ntfy.' }
		]
	}
} satisfies Command;
