import type { Command } from '../commands.ts';

export default {
	order: 20, code: 'IMP', route: '/imp', key: 'Importante', desc: 'Lo más importante de hoy, la semana, el mes y el año (sin IA)', sources: 'Todos los titulares, BOE, Federal Register, Wikipedia', pinned: true, aliases: ['importante', 'destacado'],
	manual: {
		section: 'Portada y resumen',
		what: 'Los temas más importantes de hoy, la semana, el mes y el año, puntuados por cuántos medios y secciones los cuentan y cuánto duran. Sin IA.',
		tips: [
			'Elige periodo (Hoy, Semana, Mes, Año) y sección; los dos quedan en la URL, así que un favorito abre lo mismo.',
			'Puntos: 2 por cada medio más, 1,5 por cada sección más, hasta 4 por seguir vivo y 3 si lo confirma una fuente oficial o Wikipedia.',
			'Con el selector ES / EN ves los titulares traducidos o en su idioma original.'
		],
		panels: [{ name: 'Hoy / Últimos N días', what: 'La lista de temas por puntuación; toca uno para ver todos sus medios.' }]
	}
} satisfies Command;
