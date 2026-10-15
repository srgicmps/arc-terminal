import type { Command } from '../commands.ts';

export default {
	order: 265, code: 'BIENVENIDA', route: '/bienvenida', key: 'Bienvenida', desc: 'Empieza aquí: elige lo que te interesa y Arc se ajusta a ti', sources: 'Arc Terminal', aliases: ['empezar', 'primeros pasos', 'recorrido', 'tour', 'perfil'],
	manual: {
		section: 'Sistema',
		what: 'La bienvenida que sale la primera vez: eliges lo que te interesa (o un perfil ya hecho), tu ciudad y el modo, y Arc monta tu portada, tu vista de inicio, una lista de valores de ejemplo y una propuesta de avisos. Al final, un recorrido corto. Se puede repetir cuando quieras.',
		tips: ['No borra nada tuyo: tu lista de valores solo se rellena si está vacía y los paneles fijados se suman.', 'Los paneles ocultos de la portada se vuelven a enseñar desde el modo modular (▦).'],
		panels: [
			{ name: 'Qué te interesa', what: 'Perfiles («Inversor», «Curioso de noticias», «Ahorro y hogar», «Todo») o temas sueltos.' },
			{ name: 'Tu ciudad', what: 'Para el tiempo, la luz, la gasolina y la hora.' },
			{ name: 'Cómo lo quieres', what: 'Sencillo (con explicaciones) o Terminal (denso, como Bloomberg).' },
			{ name: 'Recorrido', what: 'Cinco pasos: la barra, las vistas, tocar un dato, los avisos e instalar en el móvil.' }
		]
	}
} satisfies Command;
