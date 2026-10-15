import type { Command } from '../commands.ts';

export default {
	order: 265, code: 'BIENVENIDA', route: '/bienvenida', key: 'Bienvenida', desc: 'Empieza aquí: elige lo que te interesa y Arc se ajusta a ti', sources: 'Arc Terminal', aliases: ['empezar', 'primeros pasos', 'recorrido', 'tour', 'perfil'],
	manual: {
		section: 'Sistema',
		what: 'Sale la primera vez: eliges lo que te interesa (o un perfil), tu ciudad y el modo, y Arc monta tu portada, tu inicio, valores de ejemplo y una propuesta de avisos. Luego, un recorrido. Se puede repetir.',
		tips: ['No borra nada tuyo. Lo oculto de la portada vuelve con el modo modular (▦).'],
		panels: [
			{ name: 'Qué te interesa', what: 'Un perfil ya hecho o temas sueltos.' },
			{ name: 'Recorrido', what: 'La barra, las vistas, tocar un dato, los avisos e instalar en el móvil.' }
		]
	}
} satisfies Command;
