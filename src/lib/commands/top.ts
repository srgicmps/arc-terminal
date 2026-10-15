import type { Command } from '../commands.ts';

export default {
	order: 10, code: 'TOP', route: '/', key: 'Portada', desc: 'Portada: lo más importante de cada sección', sources: 'Todas', pinned: true,
	manual: {
		section: 'Portada y resumen',
		what: 'La portada: un vistazo a todo en una pantalla. Cada panel resume una sección y su enlace «CÓDIGO ›» abre la vista completa.',
		tips: [
			'La línea de arriba cuenta los titulares nuevos desde tu última visita y la franja de luz más barata del día.',
			'«Mi mañana» junta tiempo, luz, resultados, reuniones de bancos centrales y festivos; a partir de las 11:00 se pliega en una línea.',
			'Con el botón ▦ de la cabecera puedes ocultar, ordenar y ensanchar los paneles de la portada.'
		],
		panels: [
			{ name: 'Tipos y bonos', what: 'Tipo de depósito del BCE, euríbor a 12 meses y bono español a 10 años.' },
			{ name: 'Macro', what: 'Último dato de paro e inflación de España, la zona euro y EE. UU.' },
			{ name: 'Divisas y cripto', what: 'El euro frente al dólar, la libra y el yen, y las dos mayores criptomonedas.' },
			{ name: 'Titulares', what: 'Lo último de todas las secciones.' },
			{ name: 'Menorca', what: 'Tiempo ahora en Maó y lo que viene.' },
			{ name: 'Luz', what: 'Precio del PVPC ahora, el más barato y el de mañana si ya está publicado.' },
			{ name: 'Gasolina 95 · Menorca', what: 'Las gasolineras más baratas de la isla.' },
			{ name: 'BOE de hoy', what: 'Las primeras disposiciones generales del día.' },
			{ name: 'Terremotos', what: 'Los más fuertes de las últimas 48 horas.' },
			{ name: 'Mercados de predicción', what: 'Probabilidades de Polymarket sobre geopolítica.' },
			{ name: 'Hacker News', what: 'Lo más votado de la portada.' }
		]
	}
} satisfies Command;
