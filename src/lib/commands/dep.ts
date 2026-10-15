import type { Command } from '../commands.ts';

export default {
	order: 232, code: 'DEP', route: '/dep', key: 'Deportes', desc: 'LaLiga, Champions y Fórmula 1: clasificación, resultados y calendario', sources: 'football-data.org, Jolpica', aliases: ['deportes', 'fútbol', 'futbol', 'liga', 'champions', 'f1', 'fórmula 1'],
	manual: {
		section: 'Utilidades',
		what: 'Cómo van LaLiga, la Champions y el Mundial de Fórmula 1: clasificaciones, últimos resultados y lo que viene.',
		tips: ['El fútbol necesita el token gratuito de football-data.org (FOOTBALL_DATA_TOKEN); sin él, solo sale la F1.', 'Las horas van en hora de Madrid.'],
		panels: [
			{ name: 'LaLiga y Champions', what: 'Clasificación, últimos resultados y próximos partidos de cada competición.' },
			{ name: 'F1: pilotos y escuderías', what: 'Puntos del Mundial y victorias.' },
			{ name: 'F1: última carrera', what: 'Los diez primeros y su tiempo.' },
			{ name: 'F1: próximas carreras', what: 'Las que quedan, con su fecha.' }
		]
	}
} satisfies Command;
